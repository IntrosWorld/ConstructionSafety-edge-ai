const scenarios = [
  {
    title: "Worker behind reversing dump truck",
    severity: "critical",
    risk: 91,
    latency: 38,
    reason:
      "Worker track intersects dump-truck reverse blind spot. Time-to-collision is below 2.0 seconds.",
  },
  {
    title: "Worker inside excavator swing radius",
    severity: "critical",
    risk: 88,
    latency: 42,
    reason:
      "Excavator boom swept sector overlaps tracked worker position inside the red exclusion zone.",
  },
  {
    title: "Missing helmet under suspended load",
    severity: "high",
    risk: 74,
    latency: 35,
    reason:
      "PPE classifier reports no helmet while the worker remains inside the crane load drop zone.",
  },
  {
    title: "Loader crossing pedestrian path",
    severity: "medium",
    risk: 62,
    latency: 44,
    reason:
      "Projected loader path overlaps pedestrian trajectory within the next 3.8 seconds.",
  },
];

const alerts = [
  {
    title: "Dump truck blind spot",
    severity: "critical",
    confidence: "0.94",
    text: "Worker ID W01 detected inside reverse danger zone. Reason: reversing vehicle, worker track, TTC < 2s.",
  },
  {
    title: "Excavator swing radius",
    severity: "critical",
    confidence: "0.91",
    text: "Worker ID W02 detected inside active excavator sweep sector. Reason: boom angle + radius overlap.",
  },
  {
    title: "PPE violation",
    severity: "high",
    confidence: "0.87",
    text: "Worker ID W03 missing helmet near crane load zone. Reason: helmet absent + suspended load proximity.",
  },
  {
    title: "Pedestrian collision risk",
    severity: "medium",
    confidence: "0.82",
    text: "Forklift route intersects worker crossing path. Reason: predicted path overlap and closing speed.",
  },
];

const validations = [
  ["Dump truck reverse blind spot", "PASS", "91"],
  ["Excavator swing radius intrusion", "PASS", "88"],
  ["Crane load PPE violation", "PASS", "74"],
  ["Forklift pedestrian path overlap", "PASS", "62"],
  ["Restricted trench zone intrusion", "PASS", "58"],
  ["Low-light CCTV robustness", "FAIL", "41"],
];

const cameraFeeds = [
  {
    id: "overview",
    name: "Overview Camera",
    role: "Whole-site validation",
    image: "/outputs/unreal_viewport_topdown.png",
    fallback: "/outputs/unreal_viewport_topdown.png",
    latency: "32 ms",
  },
  {
    id: "haul-road",
    name: "CCTV Haul Road",
    role: "Dump-truck reverse blind spot",
    image: "/outputs/feeds/cctv_haul_road.png",
    fallback: "/outputs/unreal_viewport_overview.png",
    latency: "34 ms",
  },
  {
    id: "excavator",
    name: "CCTV Excavator Pit",
    role: "Swing-radius intrusion",
    image: "/outputs/feeds/cctv_excavator_pit.png",
    fallback: "/outputs/unreal_viewport_final.png",
    latency: "41 ms",
  },
  {
    id: "crane",
    name: "CCTV Crane Zone",
    role: "Suspended-load and PPE zone",
    image: "/outputs/feeds/cctv_crane_zone.png",
    fallback: "/outputs/unreal_viewport_capture_fixed.png",
    latency: "39 ms",
  },
  {
    id: "truck",
    name: "Truck Rear Camera",
    role: "Vehicle-mounted reversing view",
    image: "/outputs/feeds/truck_rear.png",
    fallback: "/outputs/unreal_viewport_capture.png",
    latency: "45 ms",
  },
  {
    id: "drone",
    name: "Sky Drone Camera",
    role: "Movable aerial camera coverage",
    image: "/outputs/feeds/drone_skycam.png",
    fallback: "/outputs/unreal_viewport_topdown.png",
    latency: "48 ms",
  },
  {
    id: "rover",
    name: "Field Robot Camera",
    role: "Movable ground robot view",
    image: "/outputs/feeds/rover_fieldcam.png",
    fallback: "/outputs/unreal_viewport_final.png",
    latency: "51 ms",
  },
];

const cameras = [
  ["Overview Camera", "32 ms", "online"],
  ["CCTV Haul Road", "34 ms", "online"],
  ["CCTV Excavator Pit", "41 ms", "online"],
  ["CCTV Crane Zone", "39 ms", "online"],
  ["Truck Rear Camera", "45 ms", "online"],
  ["Sky Drone Camera", "48 ms", "online"],
  ["Field Robot Camera", "51 ms", "online"],
];

let activeScenario = 0;
let activeFeedIndex = 0;
let feedRefreshToken = Date.now();
let latencyHistory = Array.from({ length: 18 }, (_, index) => 30 + ((index * 7) % 20));

const riskScore = document.querySelector("#riskScore");
const riskLabel = document.querySelector("#riskLabel");
const riskBar = document.querySelector("#riskBar");
const reasonBox = document.querySelector("#reasonBox");
const latencyNow = document.querySelector("#latencyNow");
const criticalCount = document.querySelector("#criticalCount");
const passRate = document.querySelector("#passRate");
const alertList = document.querySelector("#alertList");
const validationTable = document.querySelector("#validationTable");
const cameraGrid = document.querySelector("#cameraGrid");
const activeFeed = document.querySelector("#activeFeed");
const feedGrid = document.querySelector("#feedGrid");
const feedState = document.querySelector("#feedState");
const latencyChart = document.querySelector("#latencyChart");
const clock = document.querySelector("#clock");
const cycleAlert = document.querySelector("#cycleAlert");

function imageWithRefresh(path) {
  return `${path}?t=${feedRefreshToken}`;
}

function feedImageMarkup(feed, className = "") {
  return `<img ${className ? `class="${className}"` : ""} src="${imageWithRefresh(feed.image)}" alt="${feed.name}" onerror="this.onerror=null;this.src='${feed.fallback}'" />`;
}

function severityLabel(risk) {
  if (risk >= 85) return "Severe";
  if (risk >= 70) return "High";
  if (risk >= 55) return "Elevated";
  return "Nominal";
}

function renderAlerts() {
  alertList.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert ${alert.severity}">
          <div class="alert-title">
            <span>${alert.title}</span>
            <span>${alert.confidence}</span>
          </div>
          <p>${alert.text}</p>
        </article>
      `
    )
    .join("");
}

function renderValidation() {
  validationTable.innerHTML = validations
    .map((row) => {
      const resultClass = row[1] === "PASS" ? "pass" : "fail";
      return `
        <div class="row">
          <strong>${row[0]}</strong>
          <span class="result ${resultClass}">${row[1]}</span>
          <span>${row[2]} risk</span>
        </div>
      `;
    })
    .join("");
}

function renderCameras() {
  cameraGrid.innerHTML = cameras
    .map(
      (camera) => `
        <div class="camera">
          <strong>${camera[0]}<span>${camera[2]}</span></strong>
          <span>Inference latency ${camera[1]}</span>
        </div>
      `
    )
    .join("");
}

function renderFeeds() {
  const feed = cameraFeeds[activeFeedIndex];
  activeFeed.innerHTML = `
    ${feedImageMarkup(feed)}
    <div class="feed-overlay">
      <div class="feed-title">
        <strong>${feed.name}</strong>
        <span>${feed.role}</span>
      </div>
      <span class="feed-status">live ${feed.latency}</span>
    </div>
  `;
  feedGrid.innerHTML = cameraFeeds
    .map(
      (item, index) => `
        <button class="feed-tile ${index === activeFeedIndex ? "active" : ""}" type="button" data-feed-index="${index}">
          ${feedImageMarkup(item)}
          <span>${item.name}</span>
        </button>
      `
    )
    .join("");
  feedState.textContent = `${cameraFeeds.length} Unreal feeds`;
}

function renderLatency() {
  latencyChart.innerHTML = latencyHistory
    .map((value) => `<span style="height:${Math.max(12, value * 1.45)}px"></span>`)
    .join("");
}

function applyScenario(index) {
  const scenario = scenarios[index];
  riskScore.textContent = scenario.risk;
  riskLabel.textContent = severityLabel(scenario.risk);
  riskBar.style.width = `${scenario.risk}%`;
  reasonBox.textContent = scenario.reason;
  latencyNow.textContent = `${scenario.latency} ms`;
}

function tick() {
  const jitter = Math.round(28 + Math.random() * 22);
  latencyHistory = [...latencyHistory.slice(1), jitter];
  latencyNow.textContent = `${jitter} ms`;
  clock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  renderLatency();
}

function init() {
  criticalCount.textContent = alerts.filter((alert) => alert.severity === "critical").length;
  passRate.textContent = `${Math.round((validations.filter((row) => row[1] === "PASS").length / validations.length) * 100)}%`;
  renderAlerts();
  renderValidation();
  renderCameras();
  renderFeeds();
  renderLatency();
  applyScenario(activeScenario);
  feedGrid.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-feed-index]");
    if (!tile) return;
    activeFeedIndex = Number(tile.dataset.feedIndex);
    renderFeeds();
  });
  cycleAlert.addEventListener("click", () => {
    activeScenario = (activeScenario + 1) % scenarios.length;
    applyScenario(activeScenario);
  });
  setInterval(() => {
    feedRefreshToken = Date.now();
    renderFeeds();
  }, 3500);
  setInterval(tick, 1200);
}

init();
