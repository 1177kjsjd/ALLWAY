import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { COLORS, DEFAULT_REGION } from "./src/config";
import { getWalkingRoute } from "./src/services/routing";
import { addLocalReport, getLocalReports } from "./src/services/reports";
import { MobilityMode, Obstacle, ObstacleType, RouteResult } from "./src/types";

const MODES: { key: MobilityMode; label: string }[] = [
  { key: "wheelchair", label: "휠체어" },
  { key: "blind", label: "시각장애" },
  { key: "walking", label: "보행 약자" },
  { key: "general", label: "일반 보행" },
];

const OBSTACLES: { key: ObstacleType; label: string }[] = [
  { key: "blocked", label: "통행 방해" },
  { key: "stairs", label: "계단" },
  { key: "broken", label: "보도 파손" },
  { key: "tactile", label: "점자블록 문제" },
  { key: "curb", label: "높은 턱" },
  { key: "elevator", label: "엘리베이터 고장" },
  { key: "ramp", label: "경사로 문제" },
  { key: "construction", label: "공사 구간" },
];

export default function App() {
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destination, setDestination] = useState("");
  const [destinationPoint, setDestinationPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mode, setMode] = useState<MobilityMode>("wheelchair");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Obstacle[]>([]);
  const [reportType, setReportType] = useState<ObstacleType>("blocked");
  const [reportNote, setReportNote] = useState("");
  const [tab, setTab] = useState<"map" | "report">("map");

  useEffect(() => {
    setReports(getLocalReports());
    requestLocation();
  }, []);

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("위치 권한 필요", "현재 위치에서 길찾기를 하려면 위치 권한을 허용해 주세요.");
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    setOrigin(point);
    setRegion({ ...point, latitudeDelta: 0.012, longitudeDelta: 0.012 });
  }

  async function findRoute() {
    if (!origin) {
      Alert.alert("현재 위치 확인 중", "위치 권한을 허용하고 잠시 기다려 주세요.");
      return;
    }
    if (!destination.trim()) {
      Alert.alert("목적지 입력", "목적지 이름을 입력해 주세요. MVP에서는 목적지 좌표 선택 기능이 아직 연결되지 않았습니다.");
      return;
    }
    if (!destinationPoint) {
      Alert.alert("목적지 좌표 필요", "현재 MVP는 목적지 검색 지오코딩이 아직 연결되지 않았습니다. 개발 설정에서 목적지 좌표 선택 기능을 연결해야 실제 경로를 계산할 수 있습니다.");
      return;
    }
    try {
      setLoading(true);
      const result = await getWalkingRoute(origin, destinationPoint, mode);
      setRoute(result);
      if (result.instructions[0]) Speech.speak(result.instructions[0], { language: "ko-KR" });
      Alert.alert("경로 계산 완료", `${result.distanceKm.toFixed(1)} km · 약 ${result.durationMinutes}분\n${result.warning}`);
    } catch (error: any) {
      Alert.alert("경로 안내 오류", error?.message || "경로를 계산하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function speakNext() {
    if (!route?.instructions.length) {
      Speech.speak("아직 경로 안내가 없습니다. 먼저 목적지를 선택해 주세요.", { language: "ko-KR" });
      return;
    }
    Speech.speak(route.instructions[0], { language: "ko-KR", rate: 0.88 });
  }

  function submitReport() {
    if (!origin) {
      Alert.alert("위치 필요", "제보 위치를 확인할 수 있도록 위치 권한을 허용해 주세요.");
      return;
    }
    const report = addLocalReport({
      type: reportType,
      latitude: origin.latitude,
      longitude: origin.longitude,
      note: reportNote.trim(),
    });
    setReports(getLocalReports());
    setReportNote("");
    Alert.alert("기기에 임시 저장됨", "제보는 이 기기의 앱 실행 중에만 보관됩니다. 서버로 전송되거나 다른 사용자에게 공유되지는 않습니다.");
    setTab("map");
  }

  const markers = useMemo(() => reports, [reports]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>A</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>모두의 길 <Text style={styles.brandEn}>ALLWAY</Text></Text>
            <Text style={styles.subtitle}>모두를 위한 접근 가능한 길안내</Text>
          </View>
          <TouchableOpacity style={styles.locationButton} onPress={requestLocation}>
            <Text style={styles.locationButtonText}>GPS 갱신</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setTab("map")} style={[styles.tab, tab === "map" && styles.activeTab]}>
            <Text style={[styles.tabText, tab === "map" && styles.activeTabText]}>지도·길찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab("report")} style={[styles.tab, tab === "report" && styles.activeTab]}>
            <Text style={[styles.tabText, tab === "report" && styles.activeTabText]}>장애물 제보</Text>
          </TouchableOpacity>
        </View>

        {tab === "map" ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>어디로 이동하시나요?</Text>
              <TextInput
                style={styles.input}
                placeholder="목적지 이름"
                value={destination}
                onChangeText={(v) => { setDestination(v); setDestinationPoint(null); }}
                accessibilityLabel="목적지 이름"
              />
              <Text style={styles.label}>이동 유형</Text>
              <View style={styles.modeRow}>
                {MODES.map((item) => (
                  <TouchableOpacity key={item.key} onPress={() => setMode(item.key)}
                    style={[styles.modeChip, mode === item.key && styles.modeSelected]}
                    accessibilityRole="radio" accessibilityState={{ selected: mode === item.key }}>
                    <Text style={[styles.modeText, mode === item.key && styles.modeTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helper}>목적지 검색 및 지도에서 좌표 지정은 다음 개발 단계에서 연결합니다.</Text>
              <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.6 }]} onPress={findRoute} disabled={loading}>
                <Text style={styles.primaryButtonText}>{loading ? "경로 계산 중..." : "접근성 경로 찾기"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapCard}>
              <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}
                showsUserLocation={!!origin} showsMyLocationButton>
                {origin && <Marker coordinate={origin} title="현재 위치" pinColor={COLORS.green} />}
                {destinationPoint && <Marker coordinate={destinationPoint} title={destination || "목적지"} />}
                {route && <Polyline coordinates={route.coordinates} strokeColor={COLORS.green} strokeWidth={5} />}
                {markers.map((item) => <Marker key={item.id}
                  coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                  title={`미검증 제보: ${OBSTACLES.find(x => x.key === item.type)?.label || item.type}`}
                  description={item.note || "사용자 제보 · 확인 전"} pinColor="#D97706" />)}
              </MapView>
              <Text style={styles.mapCaption}>지도 데이터와 제보의 정확도는 지역별로 다를 수 있습니다.</Text>
            </View>

            {route && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>경로 정보</Text>
                <Text style={styles.routeMetric}>{route.distanceKm.toFixed(1)} km · 약 {route.durationMinutes}분</Text>
                <Text style={styles.helper}>{route.warning}</Text>
                {route.instructions.slice(0, 4).map((line, i) => <Text key={i} style={styles.instruction}>• {line}</Text>)}
                <TouchableOpacity style={styles.secondaryButton} onPress={speakNext}>
                  <Text style={styles.secondaryButtonText}>🔊 다음 안내 듣기</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>안전 안내</Text>
              <Text style={styles.noticeText}>이 MVP는 보행로의 모든 장애물을 감지하거나 안전을 보장하지 않습니다. 미확인 구간에서는 주변을 직접 확인하고, 위험하면 이동을 중단해 주세요.</Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>주변 장애물 제보</Text>
              <Text style={styles.helper}>현재 GPS 위치를 제보 위치로 사용합니다. 다른 사람에게 공개되기 전 검증이 필요합니다.</Text>
              <View style={styles.reportGrid}>
                {OBSTACLES.map((item) => (
                  <TouchableOpacity key={item.key} onPress={() => setReportType(item.key)}
                    style={[styles.reportChip, reportType === item.key && styles.reportSelected]}>
                    <Text style={[styles.reportText, reportType === item.key && styles.reportTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.input, styles.noteInput]} placeholder="상세 설명 (선택)" value={reportNote}
                onChangeText={setReportNote} multiline accessibilityLabel="장애물 상세 설명" />
              <TouchableOpacity style={styles.primaryButton} onPress={submitReport}>
                <Text style={styles.primaryButtonText}>현재 위치로 제보 저장</Text>
              </TouchableOpacity>
              <Text style={styles.helper}>현재는 로컬 임시 저장입니다. 서버 전송·사진 업로드·관리자 검증은 미구현입니다.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>이 기기의 제보 ({reports.length})</Text>
              {reports.length === 0 ? <Text style={styles.helper}>아직 제보가 없습니다.</Text> : reports.map((r) => (
                <View key={r.id} style={styles.reportItem}>
                  <Text style={styles.reportItemTitle}>{OBSTACLES.find(x => x.key === r.type)?.label} · 미검증</Text>
                  <Text style={styles.helper}>{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</Text>
                  {!!r.note && <Text>{r.note}</Text>}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 10, backgroundColor: COLORS.white },
  logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontSize: 25, fontWeight: "900" },
  brand: { fontSize: 20, fontWeight: "800", color: COLORS.ink },
  brandEn: { fontSize: 11, color: COLORS.green, fontWeight: "800" },
  subtitle: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  locationButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, backgroundColor: "#E8F3ED" },
  locationButtonText: { color: COLORS.green, fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", backgroundColor: COLORS.white, paddingHorizontal: 18, gap: 8 },
  tab: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 3, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: COLORS.green },
  tabText: { color: COLORS.muted, fontWeight: "600" },
  activeTabText: { color: COLORS.green },
  content: { padding: 14, gap: 12, paddingBottom: 36 },
  card: { backgroundColor: COLORS.white, borderRadius: 17, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.ink },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 13, fontSize: 15, color: COLORS.ink, backgroundColor: "#FCFDFC" },
  label: { color: COLORS.ink, fontWeight: "700", marginTop: 3 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  modeChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  modeSelected: { backgroundColor: "#E5F3EB", borderColor: COLORS.green },
  modeText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  modeTextSelected: { color: COLORS.green },
  helper: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  primaryButton: { backgroundColor: COLORS.green, padding: 15, borderRadius: 12, alignItems: "center", marginTop: 3 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "800" },
  mapCard: { backgroundColor: COLORS.white, borderRadius: 17, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  map: { height: 310, width: "100%" },
  mapCaption: { padding: 10, fontSize: 11, color: COLORS.muted },
  routeMetric: { color: COLORS.green, fontSize: 22, fontWeight: "800" },
  instruction: { color: COLORS.ink, fontSize: 14, lineHeight: 21 },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.green, padding: 13, borderRadius: 11, alignItems: "center" },
  secondaryButtonText: { color: COLORS.green, fontWeight: "700" },
  notice: { backgroundColor: "#FFF7E8", borderRadius: 13, padding: 14, gap: 5 },
  noticeTitle: { color: "#92400E", fontWeight: "800" },
  noticeText: { color: "#78350F", fontSize: 12, lineHeight: 18 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportChip: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12 },
  reportSelected: { backgroundColor: "#E5F3EB", borderColor: COLORS.green },
  reportText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  reportTextSelected: { color: COLORS.green },
  noteInput: { minHeight: 85, textAlignVertical: "top" },
  reportItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 4 },
  reportItemTitle: { fontWeight: "700", color: COLORS.ink },
});
