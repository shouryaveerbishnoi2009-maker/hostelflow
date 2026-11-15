import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { api } from "./services/api";
// @ts-expect-error – jsqr ships a CJS/UMD build
import jsQRModule from "jsqr";
// Handle CJS default-export interop: Vite may give us { default: fn } or fn directly
const jsQR: (data: Uint8ClampedArray, width: number, height: number, options?: Record<string, unknown>) => { data: string } | null =
  typeof jsQRModule === "function" ? jsQRModule : (jsQRModule as any).default;

type View = "home" | "mess" | "laundry" | "profile" | "admin" | "staff" | "qr";
type MealName = "Breakfast" | "Lunch" | "High Tea" | "Dinner";
type AuthStage = "login" | "otp" | "setup" | "app";
type IconName =
  | "home"
  | "mess"
  | "laundry"
  | "user"
  | "scan"
  | "arrow"
  | "clock"
  | "spark"
  | "bag"
  | "calendar"
  | "close"
  | "check"
  | "bell"
  | "logout";

const MEAL_SCHEDULE: { name: MealName; start: number; end: number; time: string }[] = [
  { name: "Breakfast", start: 8 * 60, end: 9 * 60, time: "8–9 AM" },
  { name: "Lunch", start: 11 * 60 + 30, end: 14 * 60, time: "11:30 AM–2 PM" },
  { name: "High Tea", start: 17 * 60, end: 18 * 60, time: "5–6 PM" },
  { name: "Dinner", start: 20 * 60, end: 22 * 60, time: "8–10 PM" },
];

const WEEKLY_MENU: Record<string, Record<MealName, string>> = {
  Monday: { Breakfast: "Aloo paratha & curd", Lunch: "Kurkure bhindi & lobia masala", "High Tea": "Dal vada", Dinner: "Achari aloo & kala chana" },
  Tuesday: { Breakfast: "Uttapam, sambhar & chutney", Lunch: "Rajma & veg kofta", "High Tea": "Crispy corn", Dinner: "Mutter masala & jeera rice" },
  Wednesday: { Breakfast: "Poha", Lunch: "Stuffed tomato & dal rice", "High Tea": "Bhel puri", Dinner: "Bhindi do pyaza & egg curry" },
  Thursday: { Breakfast: "Idli sambhar & chutney", Lunch: "Honey chilli potato & dal", "High Tea": "Aloo chole tikki", Dinner: "Kadhai paneer & veg biryani" },
  Friday: { Breakfast: "Moong dal chilla", Lunch: "Aloo chole puri & soyabean rice", "High Tea": "Samosa", Dinner: "Idli, uttapam & sambhar" },
  Saturday: { Breakfast: "Methi thepla", Lunch: "Rajma, mix veg & rice", "High Tea": "Cutlet", Dinner: "Paneer toofani & green rice" },
  Sunday: { Breakfast: "Masala dosa & sambhar", Lunch: "Kadhi pakoda & veg Jaipuri", "High Tea": "Paani puri", Dinner: "Chole bhature & masala rice" },
};

const SERVING_TIME: Record<MealName, string> = {
  Breakfast: "~2 min to serve",
  Lunch: "~3 min to serve",
  "High Tea": "~2 min to serve",
  Dinner: "~5 min to serve",
};

const PREP_MINUTES: Record<MealName, number> = {
  Breakfast: 2,
  Lunch: 3,
  "High Tea": 2,
  Dinner: 5,
};

const EATING_MINUTES: Record<MealName, number> = {
  Breakfast: 15,
  Lunch: 20,
  "High Tea": 15,
  Dinner: 20,
};

const FORECASTS: Record<MealName, { time: string; value: number; label: string; level: number; best?: boolean }[]> = {
  Breakfast: [
    { time: "8:00", value: 70, label: "Busy", level: 4 },
    { time: "8:15", value: 52, label: "Moderate", level: 3 },
    { time: "8:30", value: 28, label: "Quiet", level: 1, best: true },
    { time: "8:45", value: 38, label: "Quiet", level: 2 },
  ],
  Lunch: [
    { time: "11:30", value: 42, label: "Quiet", level: 2 },
    { time: "11:45", value: 58, label: "Moderate", level: 3 },
    { time: "12:00", value: 75, label: "Busy", level: 4 },
    { time: "12:15", value: 68, label: "Busy", level: 4 },
    { time: "12:30", value: 55, label: "Moderate", level: 3 },
    { time: "12:45", value: 40, label: "Quiet", level: 2 },
    { time: "1:00", value: 31, label: "Quiet", level: 1, best: true },
    { time: "1:15", value: 44, label: "Quiet", level: 2 },
    { time: "1:30", value: 58, label: "Moderate", level: 3 },
    { time: "1:45", value: 35, label: "Quiet", level: 2 },
  ],
  "High Tea": [
    { time: "5:00", value: 61, label: "Moderate", level: 3 },
    { time: "5:15", value: 74, label: "Busy", level: 4 },
    { time: "5:30", value: 42, label: "Quiet", level: 2 },
    { time: "5:45", value: 24, label: "Quiet", level: 1, best: true },
  ],
  Dinner: [
    { time: "8:00", value: 78, label: "Busy", level: 4 },
    { time: "8:15", value: 62, label: "Moderate", level: 3 },
    { time: "8:30", value: 34, label: "Quiet", level: 2, best: true },
    { time: "8:45", value: 40, label: "Quiet", level: 2 },
    { time: "9:00", value: 56, label: "Moderate", level: 3 },
    { time: "9:15", value: 68, label: "Busy", level: 4 },
    { time: "9:30", value: 48, label: "Moderate", level: 3 },
    { time: "9:45", value: 29, label: "Quiet", level: 1 },
  ],
};

const LIVE_ENTRY_GROUPS: Record<MealName, { offset: number; count: number; duration: number }[]> = {
  Breakfast: [
    { offset: 0, count: 12, duration: 20 },
    { offset: 15, count: 8, duration: 22 },
    { offset: 30, count: 6, duration: 18 },
  ],
  Lunch: [
    { offset: 0, count: 18, duration: 26 },
    { offset: 15, count: 13, duration: 25 },
    { offset: 30, count: 11, duration: 24 },
    { offset: 60, count: 9, duration: 23 },
  ],
  "High Tea": [
    { offset: 0, count: 10, duration: 24 },
    { offset: 15, count: 6, duration: 20 },
    { offset: 30, count: 4, duration: 18 },
  ],
  Dinner: [
    { offset: 0, count: 20, duration: 27 },
    { offset: 15, count: 12, duration: 26 },
    { offset: 30, count: 9, duration: 24 },
    { offset: 60, count: 11, duration: 25 },
    { offset: 90, count: 8, duration: 22 },
  ],
};

function getLiveBreakdown(date: Date, meal: (typeof MEAL_SCHEDULE)[number]) {
  const elapsed = date.getHours() * 60 + date.getMinutes() - meal.start;
  const groups = LIVE_ENTRY_GROUPS[meal.name]
    .filter((group) => elapsed >= group.offset && elapsed < group.offset + group.duration)
    .map((group) => {
      const minutesSinceEntry = elapsed - group.offset;
      const served = Math.min(
        group.count,
        Math.max(0, Math.floor((minutesSinceEntry - PREP_MINUTES[meal.name]) / 0.75)),
      );
      return {
        ...group,
        enteredAt: meal.start + group.offset,
        waiting: group.count - served,
        eating: served,
        expectedExit: meal.start + group.offset + group.duration,
      };
    });

  return {
    waiting: groups.reduce((total, group) => total + group.waiting, 0),
    eating: groups.reduce((total, group) => total + group.eating, 0),
    active: groups.reduce((total, group) => total + group.count, 0),
    groups,
  };
}

function getMealContext(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const openMeal = MEAL_SCHEDULE.find((meal) => minutes >= meal.start && minutes < meal.end);
  if (openMeal) return { meal: openMeal, isOpen: true, tomorrow: false };
  const nextMeal = MEAL_SCHEDULE.find((meal) => minutes < meal.start);
  return { meal: nextMeal ?? MEAL_SCHEDULE[0], isOpen: false, tomorrow: !nextMeal };
}

function formatScheduleTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getBestHistoricalSlotIndex(meal: MealName) {
  const slots = FORECASTS[meal];
  return Math.max(0, slots.findIndex((slot) => slot.best));
}

function getSlotRange(meal: (typeof MEAL_SCHEDULE)[number], index: number) {
  const slots = FORECASTS[meal.name];
  const end = index === slots.length - 1
    ? formatScheduleTime(meal.end).replace(/ (AM|PM)/, "")
    : slots[index + 1].time;
  return `${slots[index].time}–${end} ${meal.name === "Breakfast" ? "AM" : "PM"}`;
}

const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
    mess: <><path d="M6 3v7a3 3 0 0 0 3 3V3M6 7h3M16 3v18M16 3c3 2 4 5 4 8h-4" /></>,
    laundry: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 7h.01M11 7h.01" /><circle cx="12" cy="14" r="4.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><path d="M8 12h8" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
    bag: <><path d="M6 8h12l1 13H5L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M15 4h5v16h-5" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75">
        {paths[name]}
      </g>
    </svg>
  );
};

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "mess", label: "Mess", icon: "mess" },
  { id: "laundry", label: "Laundry", icon: "laundry" },
  { id: "profile", label: "Me", icon: "user" },
];

function AppButton({
  children,
  className = "",
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={`button button--${variant} ${className}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Icon name="clock" size={18} /></span>
      <span>HostelFlow</span>
    </div>
  );
}

function Home({ onNavigate, onScan, student }: { onNavigate: (view: View) => void; onScan: () => void; student?: any }) {
  const [now, setNow] = useState(new Date());
  const [laundryInfo, setLaundryInfo] = useState<{
    hasActiveRequest: boolean;
    status?: string;
    expectedReturnDatetime?: string;
    bagsAheadNow?: number;
    bagNumber?: string;
  } | null>(null);
  const [liveMess, setLiveMess] = useState<{
    isOpen: boolean;
    activeStudents?: number;
    crowdLabel?: string;
  } | null>(null);

  const roll = student?.rollNo || "2025BTECH111";
  const firstName = student?.name?.split(" ")[0] || "Shouryaveer";
  const bagNumber = laundryInfo?.bagNumber || student?.bagNumber || "B-214";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getLaundryStatus(roll).then((res) => {
      if (res) setLaundryInfo(res);
    });
    api.getLiveCrowdStatus().then((res) => {
      if (res) setLiveMess(res);
    });
  }, [roll]);

  const context = getMealContext(now);
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayMenu = WEEKLY_MENU[dayName] ?? WEEKLY_MENU.Monday;
  const bestSlotIndex = getBestHistoricalSlotIndex(context.meal.name);
  const bestSlotRange = getSlotRange(context.meal, bestSlotIndex);

  const isLaundyActive = laundryInfo ? laundryInfo.hasActiveRequest : true;
  const laundryStatus = laundryInfo?.status || "WASHING";

  return (
    <section className="screen screen--home">
      <header className="mobile-header">
        <Brand />
        <button className="icon-button" aria-label="Notifications" type="button"><Icon name="bell" /></button>
      </header>

      <div className="greeting">
        <div className="greeting-meta">
          <p className="eyebrow">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          <span>Today</span>
        </div>
        <h1>{now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"}, <span>{firstName}</span></h1>
        <p className="greeting-note">
          <span className="greeting-note-dot" />
          {context.isOpen
            ? `${context.meal.name} is being served now.`
            : `${context.meal.name} starts ${context.tomorrow ? "tomorrow " : ""}at ${formatScheduleTime(context.meal.start)}.`}
        </p>
      </div>

      <article className="now-card">
        <div className="blob blob--one" />
        <div className="blob blob--two" />
        <div className="card-content">
          <div className="card-topline">
            <span className="glass-chip">{context.isOpen ? "Serving now" : "Up next"}</span>
            <span className="mono">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <div className="now-main">
            <div>
              <h2 className="home-meal-title">{context.meal.name} {context.isOpen ? "is open" : `at ${formatScheduleTime(context.meal.start)}`}</h2>
            </div>
            <div className="crowd-ring crowd-ring--home">
              <span>{formatScheduleTime(context.meal.start).replace(/ (am|pm)/i, "").replace(":00", "")}</span><small>{formatScheduleTime(context.meal.start).slice(-2)}</small>
            </div>
          </div>
          <div className="recommendation">
            <span className="recommendation-icon"><Icon name="spark" size={17} /></span>
            <p>
              <strong>{context.isOpen ? (liveMess?.activeStudents ? `${liveMess.activeStudents} students inside right now.` : "Want the current crowd?") : `${context.meal.name} is next.`}</strong>{" "}
              {context.isOpen ? "Open Mess for today’s live status and the best remaining time to go." : `Service runs from ${context.meal.time}.`}
            </p>
          </div>
          <AppButton onClick={onScan} className="now-cta">
            <Icon name="scan" /> Scan at the mess
          </AppButton>
        </div>
      </article>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Last 30 days</p>
          <h2>Historical quietest window</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("mess")} type="button">
          Mess details <Icon name="arrow" size={16} />
        </button>
      </div>

      <button className="best-time-card" onClick={() => onNavigate("mess")} type="button">
        <div>
          <span className="status status--quiet">Quietest window</span>
          <strong>{bestSlotRange}</strong>
        </div>
        <span className="history-basis"><Icon name="calendar" size={16} /> 30-day pattern</span>
      </button>

      <button className="home-laundry-card" onClick={() => onNavigate("laundry")} type="button">
        <div className="home-laundry-copy">
          <div className="home-laundry-topline">
            <span className="paper-tag">{bagNumber}</span>
            <span className="laundry-status"><span /> {isLaundyActive ? "In progress" : "No active wash"}</span>
          </div>
          <p>Laundry update</p>
          <strong>
            {isLaundyActive
              ? laundryStatus === "READY"
                ? "Ready for collection"
                : laundryStatus === "SUBMITTED"
                  ? "In wash queue"
                  : "Currently washing"
              : "No bag in wash"}
          </strong>
          <small>
            {isLaundyActive
              ? "Your bag is on schedule and should be ready Friday morning."
              : "Submit your laundry bag at the desk to receive automated queue updates."}
          </small>
          <span className="mini-link">View laundry details <Icon name="arrow" size={14} /></span>
        </div>
        <div className="home-laundry-progress" aria-hidden="true">
          <span className="home-laundry-icon"><Icon name="bag" size={24} /></span>
          <div className="laundry-progress-line">
            <span className={isLaundyActive ? "complete" : ""} />
            <span className={isLaundyActive && laundryStatus !== "SUBMITTED" ? "complete current" : ""} />
            <span className={isLaundyActive && laundryStatus === "READY" ? "complete" : ""} />
            <span />
          </div>
          <div className="laundry-progress-labels">
            <span>Submitted</span>
            <strong>Washing</strong>
            <span>Ready</span>
          </div>
        </div>
      </button>

      <div className="section-heading section-heading--menu">
        <div>
          <p className="eyebrow">{dayName}</p>
          <h2>Today’s menu</h2>
        </div>
      </div>
      <div className="menu-list">
        {MEAL_SCHEDULE.map((item) => (
          <div className="menu-row" key={item.name}>
            <div className="meal-time">
              <span>{item.name}</span>
              <small>{item.time}</small>
            </div>
            <strong>{todayMenu[item.name]}</strong>
            <span className="prep-pill"><Icon name="clock" size={13} /> {SERVING_TIME[item.name]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Mess() {
  const [liveNow, setLiveNow] = useState(new Date());
  const initialMeal = getMealContext(liveNow).meal.name;
  const [meal, setMeal] = useState<MealName>(initialMeal);
  const [dataMode, setDataMode] = useState<"live" | "history">("live");
  const initialSlots = FORECASTS[initialMeal];
  const [selected, setSelected] = useState(Math.max(0, initialSlots.findIndex((slot) => slot.best)));

  const [serverLive, setServerLive] = useState<{
    isOpen: boolean;
    crowdLabel?: string;
    activeStudents?: number;
    waitingInQueue?: number;
    eatingCount?: number;
    nextExpectedExit?: string | null;
    recommendation?: { title: string; detail: string };
    activeEntryGroups?: Array<{
      offset: number;
      count: number;
      enteredAt: string;
      waiting: number;
      eating: number;
      expectedExit: string;
    }>;
  } | null>(null);

  const [serverForecast, setServerForecast] = useState<{
    slots: Array<{ time: string; value: number; label: string; level: number; best?: boolean }>;
    bestSlotRange: string;
    timeSavedMinutes: number;
    recommendationText: string;
  } | null>(null);

  useEffect(() => {
    api.getLiveCrowdStatus().then((res) => {
      if (res) setServerLive(res);
    });
  }, [liveNow]);

  useEffect(() => {
    api.getMealForecast(meal).then((res) => {
      if (res && res.slots) setServerForecast(res);
    });
  }, [meal]);

  const mealSlots = serverForecast?.slots ?? FORECASTS[meal] ?? FORECASTS.Dinner;
  const selectedSchedule = MEAL_SCHEDULE.find((item) => item.name === meal) ?? MEAL_SCHEDULE[3];
  const selectedIndex = Math.min(selected, mealSlots.length - 1);
  const bestIndex = Math.max(0, mealSlots.findIndex((slot) => slot.best));
  const bestRange = serverForecast?.bestSlotRange ?? getSlotRange(selectedSchedule, bestIndex);
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const menu = WEEKLY_MENU[dayName]?.[meal] ?? WEEKLY_MENU.Monday[meal];
  const currentContext = getMealContext(liveNow);
  const liveBreakdown = currentContext.isOpen ? getLiveBreakdown(liveNow, currentContext.meal) : null;
  const nextExpectedExit = liveBreakdown?.groups.length
    ? Math.min(...liveBreakdown.groups.map((group) => group.expectedExit))
    : null;

  const defaultLiveRec = !currentContext.isOpen
    ? {
        title: `${currentContext.meal.name} at ${formatScheduleTime(currentContext.meal.start)}`,
        detail: `The next live window begins ${currentContext.tomorrow ? "tomorrow " : ""}when the mess opens.`,
      }
    : !liveBreakdown?.active
      ? {
          title: "Go now",
          detail: "There are no active entries from today’s scans right now.",
        }
      : nextExpectedExit && nextExpectedExit < currentContext.meal.end
        ? {
            title: `Around ${formatScheduleTime(nextExpectedExit)}`,
            detail: "The next active group is expected to leave around this time.",
          }
        : {
            title: "Go now",
            detail: "The current meal window is nearing its end, so waiting may not leave enough serving time.",
          };

  const liveRecommendation = serverLive?.recommendation ?? defaultLiveRec;
  const liveCrowdLabel = serverLive?.crowdLabel ?? (
    !liveBreakdown
      ? "Closed"
      : liveBreakdown.active >= 25
        ? "Busy"
        : liveBreakdown.active >= 12
          ? "Moderate"
          : "Quiet"
  );

  const displayWaiting = serverLive?.waitingInQueue ?? liveBreakdown?.waiting ?? 0;
  const displayEating = serverLive?.eatingCount ?? liveBreakdown?.eating ?? 0;
  const displayActive = serverLive?.activeStudents ?? liveBreakdown?.active ?? 0;
  const displayGroups = serverLive?.activeEntryGroups ?? (liveBreakdown?.groups.map(g => ({
    ...g,
    enteredAt: formatScheduleTime(g.enteredAt),
    expectedExit: formatScheduleTime(g.expectedExit),
  })) ?? []);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Crowd intelligence</p>
          <h1>Mess crowd</h1>
        </div>
        <span className="date-pill"><Icon name="calendar" size={16} /> Today</span>
      </header>

      <div className="data-switch">
        <button className={dataMode === "live" ? "active" : ""} onClick={() => setDataMode("live")} type="button">
          <span className="live-dot" /> Today live
        </button>
        <button className={dataMode === "history" ? "active" : ""} onClick={() => setDataMode("history")} type="button">
          30-day pattern
        </button>
      </div>

      {dataMode === "live" && (
        <>
          <article className="live-queue-card">
            <div className="live-queue-heading">
              <div>
                <p className="eyebrow">Current status from today’s scans</p>
                <h2>{currentContext.isOpen ? `${currentContext.meal.name} is ${liveCrowdLabel.toLowerCase()}` : "The mess is closed right now"}</h2>
              </div>
              <span className={`status ${liveCrowdLabel === "Busy" ? "status--busy" : liveCrowdLabel === "Quiet" ? "status--quiet" : "status--live"}`}>
                {currentContext.isOpen && <span className="live-dot" />} {liveCrowdLabel}
              </span>
            </div>

            {liveBreakdown || (serverLive && serverLive.isOpen) ? (
              <>
                <div className="live-breakdown">
                  <div className="queue-stat queue-stat--waiting">
                    <small>Waiting for food</small>
                    <strong>{displayWaiting}</strong>
                    <span>Estimated serving line</span>
                  </div>
                  <div className="queue-stat">
                    <small>Likely eating</small>
                    <strong>{displayEating}</strong>
                    <span>Food probably collected</span>
                  </div>
                  <div className="queue-stat">
                    <small>Total inside</small>
                    <strong>{displayActive}</strong>
                    <span>Expected exit not passed</span>
                  </div>
                </div>

                <div className="entry-groups">
                  <div className="entry-groups-title">
                    <strong>Today’s active entry groups</strong>
                    <small>Estimated from scan time and serving speed</small>
                  </div>
                  {displayGroups.length > 0 ? displayGroups.map((group, idx) => (
                    <div className="entry-group-row" key={`${group.offset}-${idx}`}>
                      <span className="entry-time">{group.enteredAt}</span>
                      <div>
                        <strong>{group.count} students entered</strong>
                        <small>{group.waiting} waiting · {group.eating} likely eating</small>
                      </div>
                      <span className="exit-label">Exit by {group.expectedExit}</span>
                    </div>
                  )) : (
                    <p className="no-entry-copy">No active entries yet. The first QR scan will appear here.</p>
                  )}
                </div>
                <p className="estimate-disclaimer">“Food collected” is estimated from entry time and menu serving speed. A future counter scan can make this exact.</p>
              </>
            ) : (
              <div className="queue-closed">
                <span><Icon name="clock" /></span>
                <div>
                  <strong>{currentContext.meal.name} begins {currentContext.tomorrow ? "tomorrow " : ""}at {formatScheduleTime(currentContext.meal.start)}</strong>
                  <small>The live serving-line count will start when students scan in.</small>
                </div>
              </div>
            )}
          </article>

          <article className="live-timing-card">
            <div className="live-timing-icon"><Icon name="spark" size={20} /></div>
            <div>
              <p className="eyebrow">Best time to go</p>
              <h2>{liveRecommendation.title}</h2>
              <p>{liveRecommendation.detail}</p>
            </div>
            <span className="timing-source"><Icon name="clock" size={14} /> Today’s live timing</span>
          </article>
          <p className="data-note">Live status and timing use only today’s QR scans and expected exit times.</p>
        </>
      )}

      {dataMode === "history" && (
        <>
          <div className="segmented">
            {MEAL_SCHEDULE.map((item) => (
              <button
                className={meal === item.name ? "active" : ""}
                key={item.name}
                onClick={() => {
                  setMeal(item.name);
                  setSelected(Math.max(0, FORECASTS[item.name].findIndex((slot) => slot.best)));
                }}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>

          <article className="hero-recommendation">
            <div className="doodle-line" />
            <p className="eyebrow">Our historical pick</p>
            <h2>Go between<br /><span>{bestRange}</span></h2>
            <p>Usually less crowded, with a shorter serving queue after the first {meal.toLowerCase()} rush.</p>
            <div className="saving"><Icon name="clock" size={18} /><strong>Save about 12 min</strong><span>compared with {mealSlots[0].time} {meal === "Breakfast" ? "AM" : "PM"}</span></div>
          </article>

          <article className="chart-card">
            <div className="chart-heading">
              <div>
                <p className="eyebrow">Typical {dayName}</p>
                <h2>{meal} pattern</h2>
              </div>
              <span className="status status--live">30-day history</span>
            </div>
            <div className="chart">
              {mealSlots.map((slot, index) => (
                <button
                  className={`bar-column ${selectedIndex === index ? "selected" : ""}`}
                  key={slot.time}
                  onClick={() => setSelected(index)}
                  type="button"
                >
                  {slot.best && <span className="best-label">Best</span>}
                  <span className={`bar bar--${slot.level}`}><i>{slot.value}</i></span>
                  <small>{slot.time}</small>
                </button>
              ))}
            </div>
            <div className="chart-legend">
              <span><i className="legend-dot legend-dot--quiet" /> Quiet</span>
              <span><i className="legend-dot legend-dot--moderate" /> Moderate</span>
              <span><i className="legend-dot legend-dot--busy" /> Busy</span>
            </div>
          </article>

          <article className="slot-detail">
            <div>
              <span className={`status ${mealSlots[selectedIndex].label === "Busy" ? "status--busy" : "status--quiet"}`}>{mealSlots[selectedIndex].label}</span>
              <h3>{getSlotRange(selectedSchedule, selectedIndex)}</h3>
            </div>
            <div className="slot-stat">
              <strong>{mealSlots[selectedIndex].value}%</strong>
              <small>usual occupancy</small>
            </div>
            <p>{menu} is on the menu. Historical serving speed and the last 30 days of visits are used for future recommendations.</p>
          </article>
          <p className="data-note">Based on the last 30 days of mess visits in Block A.</p>
        </>
      )}
    </section>
  );
}

function Laundry({ student }: { student?: any }) {
  const roll = student?.rollNo || "2025BTECH111";
  const bagNumber = student?.bagNumber || "B-214";
  const [submitted, setSubmitted] = useState(true);
  const [laundryData, setLaundryData] = useState<{
    hasActiveRequest: boolean;
    status?: "SUBMITTED" | "WASHING" | "READY" | "RECEIVED";
    bagsAheadNow?: number;
    bagsAheadAtSubmission?: number;
    stepIndex?: number;
    expectedReturnDatetime?: string;
  } | null>(null);

  useEffect(() => {
    api.getLaundryStatus(roll).then((data) => {
      if (data) {
        setLaundryData(data);
        setSubmitted(data.hasActiveRequest);
      }
    });
  }, [roll]);

  const handleSubmitBag = async () => {
    const res = await api.submitLaundry(roll);
    if (res && res.success) {
      setSubmitted(true);
      const updated = await api.getLaundryStatus(roll);
      if (updated) setLaundryData(updated);
    } else {
      setSubmitted(true);
    }
  };

  const currentStep = laundryData?.stepIndex ?? 1;
  const bagsAhead = laundryData?.bagsAheadNow ?? 7;
  const originalAhead = laundryData?.bagsAheadAtSubmission ?? 11;
  const statusText = laundryData?.status ?? "Washing";

  return (
    <section className="screen">
      <header className="page-header">
        <div><p className="eyebrow">Your permanent bag</p><h1>Laundry</h1></div>
        <span className="paper-tag paper-tag--large">{bagNumber}</span>
      </header>

      {submitted ? (
        <>
          <article className="laundry-hero">
            <div className="laundry-art">
              <span className="bag-shape"><span>{bagNumber}</span></span>
              <i className="bubble bubble--1" /><i className="bubble bubble--2" /><i className="bubble bubble--3" />
            </div>
            <p className="eyebrow">Current request</p>
            <h2>{statusText === "READY" ? "Ready for collection!" : statusText === "SUBMITTED" ? "Bag submitted." : "It’s being washed."}</h2>
            <p>Your bag is moving as planned. We’ll let you know the moment it’s ready.</p>
            <div className="estimate">
              <span><Icon name="calendar" /></span>
              <div><small>Expected back</small><strong>Friday, around 6:00 AM</strong></div>
              <span className="status status--quiet">On track</span>
            </div>
          </article>

          <article className="tracker-card">
            <div className="section-heading"><div><p className="eyebrow">Progress</p><h2>{currentStep + 1} of 4 steps</h2></div><span className="mono">{bagsAhead} ahead</span></div>
            <div className="progress-track">
              {["Submitted", "Washing", "Ready", "Received"].map((step, index) => (
                <div className={`progress-step ${index <= currentStep ? "complete" : ""} ${index === currentStep ? "current" : ""}`} key={step}>
                  <span>{index < currentStep ? <Icon name="check" size={14} /> : index + 1}</span>
                  <small>{step}</small>
                </div>
              ))}
            </div>
            <div className="queue-visual">
              <div className="queue-copy"><strong>{bagsAhead} bags ahead now</strong><small>Down from {originalAhead} when you submitted</small></div>
              <div className="bag-row">{[1,2,3,4,5,6].map((item) => <span key={item} />)}<span className="my-bag">B</span></div>
            </div>
          </article>

          <div className="history-row">
            <div><p className="eyebrow">Last request</p><strong>21 September</strong><small>Returned on time</small></div>
            <span className="status status--quiet">Received</span>
          </div>
        </>
      ) : (
        <article className="empty-card">
          <div className="empty-icon"><Icon name="bag" size={34} /></div>
          <p className="eyebrow">Bag {bagNumber}</p>
          <h2>No bag in the wash</h2>
          <p>Submit your bag and we’ll estimate its return based on today’s queue.</p>
          <AppButton onClick={handleSubmitBag}>Submit my bag <Icon name="arrow" /></AppButton>
        </article>
      )}
      {submitted && <AppButton variant="ghost" className="demo-reset" onClick={() => setSubmitted(false)}>Preview empty state</AppButton>}
    </section>
  );
}

function Profile({ student, onLogout }: { student?: any; onLogout: () => void }) {
  const name = student?.name || "Shouryaveer Bishnoi";
  const roll = student?.rollNo || "2025BTECH111";
  const initials = name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hostel = student?.hostelName || "Block A";
  const room = student?.roomNo || "214";
  const phone = student?.phone || "+91 98••• ••240";

  return (
    <section className="screen">
      <header className="page-header"><div><p className="eyebrow">Account</p><h1>Your corner</h1></div></header>
      <article className="profile-card">
        <div className="avatar">{initials}</div>
        <div><h2>{name}</h2><p>{roll}</p></div>
        <span className="status status--quiet">{hostel}</span>
      </article>
      <div className="profile-section">
        <p className="eyebrow">Student details</p>
        <div className="detail-row"><span>Room</span><strong>{room}</strong></div>
        <div className="detail-row"><span>Phone</span><strong>{phone}</strong></div>
        <div className="detail-row"><span>Hostel</span><strong>{hostel}</strong></div>
      </div>
      <div className="profile-section">
        <p className="eyebrow">Preferences</p>
        <label className="toggle-row">
          <span><Icon name="bell" /><span><strong>Laundry updates</strong><small>Tell me when my bag is ready</small></span></span>
          <input defaultChecked type="checkbox" /><i />
        </label>
      </div>
      <button className="logout-row" onClick={onLogout} type="button"><Icon name="logout" /><span>Log out</span><Icon name="arrow" size={17} /></button>
      <p className="version">HostelFlow · Student app v1.0</p>
    </section>
  );
}

function ScanModal({ onClose, student }: { onClose: () => void; student?: any }) {
  const roll = student?.rollNo || "2025BTECH111";
  const [phase, setPhase] = useState<"scan" | "success">("scan");
  const [scanTime, setScanTime] = useState(new Date());
  const [camState, setCamState] = useState<"starting" | "live" | "denied" | "unavailable">("starting");
  const [serverResult, setServerResult] = useState<{
    alreadyCheckedIn?: boolean;
    isClosed?: boolean;
    message?: string;
    dish?: { name: string; prepMinutes: number };
    calculation?: { eatingMinutes: number; expectedExitDisplay: string; isEarlyArrival: boolean; minutesUntilOpening: number };
    visit?: { expectedExitTime: string; meal: string };
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Fire-and-forget check-in call
  const checkIn = useCallback(async (date: Date) => {
    try {
      const res = await api.scanMessQR(roll, date.toISOString());
      if (res) setServerResult(res);
    } catch { /* graceful fallback */ }
  }, [roll]);

  // Called the moment a QR code is detected
  const handleDetected = useCallback((date: Date) => {
    // Stop the scan loop immediately
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setScanTime(date);
    setPhase("success");
    checkIn(date);
  }, [checkIn]);

  useEffect(() => {
    if (phase !== "scan") return;

    let cancelled = false;

    const start = async () => {
      setCamState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCamState("live");

        // High-speed jsQR scan loop — scans ~10 times/sec
        let lastScanTime = 0;
        const scan = () => {
          if (cancelled) return;
          const now = performance.now();
          // Throttle to every ~100ms (10fps) — more than enough for QR detection
          if (now - lastScanTime >= 100) {
            lastScanTime = now;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d", { willReadFrequently: true });
            if (canvas && ctx && video.readyState >= 2) {
              const w = video.videoWidth;
              const h = video.videoHeight;
              if (w > 0 && h > 0) {
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                try {
                  const result = jsQR(imgData.data, w, h, { inversionAttempts: "dontInvert" });
                  if (result && result.data) {
                    console.log("[HostelFlow] QR detected:", result.data);
                    handleDetected(new Date());
                    return;
                  }
                } catch (e) {
                  console.error("[HostelFlow] jsQR error:", e);
                }
              }
            }
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);

      } catch (err: unknown) {
        const isPermission = err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setCamState(isPermission ? "denied" : "unavailable");
      }
    };

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [phase, handleDetected]);

  const ctx = getMealContext(scanTime);
  const scanMinutes = scanTime.getHours() * 60 + scanTime.getMinutes();
  const minsUntilOpen = ctx.tomorrow
    ? 24 * 60 - scanMinutes + ctx.meal.start
    : ctx.meal.start - scanMinutes;
  const isEarlyArrival = !ctx.isOpen && !ctx.tomorrow && minsUntilOpen > 0 && minsUntilOpen <= 15;
  const calcStart = ctx.isOpen ? scanMinutes : ctx.meal.start;
  const expectedExit = calcStart + PREP_MINUTES[ctx.meal.name] + EATING_MINUTES[ctx.meal.name] + 5;
  const canCheckIn = ctx.isOpen || isEarlyArrival;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`scan-modal ${phase === "success" ? "scan-modal--success" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose} type="button"><Icon name="close" /></button>

        {phase === "scan" ? (
          <>
            <div className="scanner-copy">
              <p className="eyebrow">Mess entrance</p>
              <h2>{camState === "live" ? "Scanning…" : "Scan the code"}</h2>
              <p>{camState === "live" ? "Hold the QR code steady in frame." : "Open the HostelFlow QR at the mess entrance."}</p>
            </div>

            {/* Viewfinder — always rendered so camera mounts fast */}
            <div className={`viewfinder viewfinder--${camState}`}>
              <video aria-hidden autoPlay muted playsInline ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: camState === "live" ? "block" : "none" }} />
              {/* Hidden canvas for jsQR pixel reads */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <i className="corner corner--tl" /><i className="corner corner--tr" />
              <i className="corner corner--bl" /><i className="corner corner--br" />
              {camState === "live" && <span className="scan-line" />}
              {camState === "starting" && (
                <div className="camera-message">
                  <span className="camera-loader" />
                  <strong>Starting camera…</strong>
                  <small>Allow camera access when prompted.</small>
                </div>
              )}
              {camState === "denied" && (
                <div className="camera-message">
                  <span className="camera-blocked"><Icon name="scan" /></span>
                  <strong>Camera blocked</strong>
                  <small>Tap the camera icon in your browser’s address bar and choose “Allow”, then reopen the scanner.</small>
                </div>
              )}
              {camState === "unavailable" && (
                <div className="camera-message">
                  <span className="camera-blocked"><Icon name="scan" /></span>
                  <strong>Camera unavailable</strong>
                  <small>Open the app at <strong>https://10.41.23.102:8443</strong> — camera requires a secure connection.</small>
                </div>
              )}
            </div>

            <div className="scan-hint">
              <span><Icon name="scan" /> {camState === "live" ? "Scanning automatically — no button needed" : "Camera only used while this panel is open"}</span>
              <button onClick={() => handleDetected(new Date())} type="button">Demo</button>
            </div>
          </>
        ) : (
          <div className="success-content">
            <div className="success-check"><Icon name={canCheckIn ? "check" : "clock"} size={32} /></div>
            <p className="eyebrow">
              {serverResult?.alreadyCheckedIn
                ? "Already checked in"
                : serverResult?.isClosed
                  ? "Mess is closed"
                  : ctx.isOpen
                    ? "Visit confirmed"
                    : isEarlyArrival
                      ? "Early arrival recorded"
                      : "Mess is closed"}
            </p>
            <h2>
              {serverResult?.alreadyCheckedIn ? (
                <>{serverResult.visit?.meal || ctx.meal.name},<br />already in.</>
              ) : ctx.isOpen ? (
                <>{ctx.meal.name},<br />you’re in.</>
              ) : isEarlyArrival ? (
                <>{ctx.meal.name} starts<br />in {minsUntilOpen} min.</>
              ) : (
                <>Next serving:<br />{ctx.meal.name}.</>
              )}
            </h2>
            <p>
              {serverResult?.alreadyCheckedIn
                ? (serverResult.message || "You’re already checked in for this meal.")
                : ctx.isOpen
                  ? "No need to scan out. We’ve worked out your expected exit."
                  : isEarlyArrival
                    ? `You’re waiting outside, so your visit starts at ${formatScheduleTime(ctx.meal.start)}—not ${scanTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
                    : `${ctx.meal.name} opens ${ctx.tomorrow ? "tomorrow " : ""}at ${formatScheduleTime(ctx.meal.start)}. Scan again within 15 minutes of opening.`}
            </p>
            {canCheckIn && !serverResult?.alreadyCheckedIn && (
              <>
                <div className="calculation">
                  <div><span>{isEarlyArrival ? "Starts" : "Entry"}</span><strong>{formatScheduleTime(calcStart).replace(" PM", "").replace(" AM", "")}</strong></div><i>+</i>
                  <div><span>Serve</span><strong>{serverResult?.dish?.prepMinutes ?? PREP_MINUTES[ctx.meal.name]}m</strong></div><i>+</i>
                  <div><span>Eat</span><strong>{serverResult?.calculation?.eatingMinutes ?? EATING_MINUTES[ctx.meal.name]}m</strong></div><i>+</i>
                  <div><span>Buffer</span><strong>5m</strong></div>
                </div>
                <div className="exit-time"><small>Expected exit</small><strong>{serverResult?.calculation?.expectedExitDisplay ?? formatScheduleTime(expectedExit)}</strong></div>
              </>
            )}
            {serverResult?.alreadyCheckedIn && (
              <div className="exit-time"><small>Calculated exit</small><strong>{serverResult.visit?.expectedExitTime || formatScheduleTime(expectedExit)}</strong></div>
            )}
            <AppButton onClick={onClose}>Done</AppButton>
          </div>
        )}
      </div>
    </div>
  );
}


function AuthFlow({
  stage,
  setStage,
  onStaffSignIn,
  onStudentAuthenticated,
}: {
  stage: AuthStage;
  setStage: (stage: AuthStage) => void;
  onStaffSignIn?: () => void;
  onStudentAuthenticated?: (student: any) => void;
}) {
  const [rollNumber, setRollNumber] = useState("2025BTECH111");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("Shouryaveer Bishnoi");
  const [hostelName, setHostelName] = useState("Block A");
  const [roomNo, setRoomNo] = useState("214");
  const [phone, setPhone] = useState("+91 98765 43240");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleContinue = async () => {
    setErrorMessage(null);
    if (!rollNumber.trim()) return;
    try {
      const res = await api.sendOtp(rollNumber);
      if (res && res.demoOtp) {
        setOtp(res.demoOtp);
      }
    } catch {
      // Fallback
    }
    setStage("otp");
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    try {
      const res = await api.verifyOtp(rollNumber, otp || "123456");
      if (res && res.success) {
        if (res.needsSetup) {
          setStage("setup");
          return;
        }
        if (res.student && onStudentAuthenticated) {
          onStudentAuthenticated(res.student);
        }
        setStage("app");
        return;
      } else if (res && res.error) {
        setErrorMessage(res.error);
        return;
      }
    } catch {
      // Fallback
    }
    setStage("app");
  };

  const handleCreateAccount = async () => {
    setErrorMessage(null);
    try {
      const res = await api.registerStudent({
        rollNo: rollNumber,
        name: fullName,
        hostelName,
        roomNo,
        phone,
      });
      if (res && res.student) {
        if (onStudentAuthenticated) onStudentAuthenticated(res.student);
        setStage("app");
        return;
      } else if (res && res.error) {
        setErrorMessage(res.error);
        return;
      }
    } catch {
      // Fallback
    }
    setStage("app");
  };

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <p className="eyebrow">Student life, simplified</p>
          <h1>Everything<br /><span>on time.</span></h1>
          <p>Mess crowds and laundry updates, at a glance.</p>
          <div className="auth-preview">
            <div><span className="live-dot" /><small>Next meal</small><strong>High Tea · 5:00 PM</strong></div>
            <span className="status status--quiet">Usually quiet</span>
          </div>
        </div>
        <p className="auth-campus">JK Lakshmipat University · Student Services</p>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand"><Brand /></div>
        {errorMessage && (
          <div style={{ padding: "10px 14px", background: "var(--terracotta-soft)", color: "var(--terracotta)", borderRadius: "10px", marginBottom: "16px", fontSize: "12px", fontWeight: 700 }}>
            {errorMessage}
          </div>
        )}

        {stage === "login" && (
          <div className="auth-form">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in</h2>
            <p className="auth-intro">Get a verification code on your registered phone.</p>
            <label className="field">
              <span>University roll number</span>
              <input autoComplete="username" onChange={(event) => setRollNumber(event.target.value)} placeholder="e.g. 2025BTECH111" value={rollNumber} />
            </label>
            <AppButton className="auth-submit" onClick={handleContinue}>Continue <Icon name="arrow" /></AppButton>
            <div className="auth-divider"><span>New student?</span></div>
            <AppButton className="auth-submit" onClick={() => setStage("setup")} variant="secondary">Create account</AppButton>
            <button className="staff-link" onClick={onStaffSignIn} type="button">Staff sign in</button>
          </div>
        )}

        {stage === "otp" && (
          <div className="auth-form">
            <button className="back-link" onClick={() => setStage("login")} type="button">← Back to sign in</button>
            <p className="eyebrow">Check your phone</p>
            <h2>Enter your code</h2>
            <p className="auth-intro">Sent for <strong>{rollNumber}</strong> (demo master code: <strong>123456</strong>).</p>
            <label className="field">
              <span>Verification code</span>
              <input
                autoComplete="one-time-code"
                className="otp-input"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                value={otp}
              />
            </label>
            <AppButton className="auth-submit" onClick={handleVerify}>Verify and continue <Icon name="check" /></AppButton>
            <button className="staff-link" onClick={handleContinue} type="button">Didn’t get it? Send a new code</button>
          </div>
        )}

        {stage === "setup" && (
          <div className="auth-form auth-form--setup">
            <button className="back-link" onClick={() => setStage("login")} type="button">← Back to sign in</button>
            <p className="eyebrow">First-time setup</p>
            <h2>Create your account</h2>
            <p className="auth-intro">Enter your university details.</p>
            <div className="field-grid">
              <label className="field field--wide"><span>Full name</span><input onChange={(e) => setFullName(e.target.value)} value={fullName} /></label>
              <label className="field field--wide"><span>University roll number</span><input onChange={(e) => setRollNumber(e.target.value)} value={rollNumber} /></label>
              <label className="field">
                <span>Hostel</span>
                <select onChange={(e) => setHostelName(e.target.value)} value={hostelName}>
                  <option>Block A</option>
                  <option>Block B</option>
                  <option>Block C</option>
                </select>
              </label>
              <label className="field"><span>Room number</span><input inputMode="numeric" onChange={(e) => setRoomNo(e.target.value)} value={roomNo} /></label>
              <label className="field field--wide"><span>Phone number</span><input inputMode="tel" onChange={(e) => setPhone(e.target.value)} value={phone} /></label>
            </div>
            <label className="consent-row"><input defaultChecked type="checkbox" /><span>Send me crowd recommendations and laundry-ready updates.</span></label>
            <AppButton className="auth-submit" onClick={handleCreateAccount}>Create my account <Icon name="arrow" /></AppButton>
          </div>
        )}
        <p className="auth-help">Need help? Contact Student Services.</p>
      </section>
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState<{
    headline?: { displayString: string; weeklyVisits: number };
    laundryWorkload?: {
      submitted: number;
      washing: number;
      ready: number;
      avgTurnaroundHours: number;
      onTimePercentage: number;
    };
    alerts?: Array<{ facility: string; message: string }>;
    dishImpact?: Array<{
      dish_name: string;
      meal_name: string;
      expected_prep_time_minutes: number;
      avg_duration_minutes: number;
    }>;
  } | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, Record<string, number>> | null>(null);

  useEffect(() => {
    api.getAdminOverview().then((res) => {
      if (res) setData(res);
    });
    api.getAdminHeatmap().then((res) => {
      if (res) setHeatmap(res);
    });
  }, []);

  const headline = data?.headline || {
    displayString: "1,184 mess visits this week, up 6%",
    weeklyVisits: 1184,
  };
  const laundry = data?.laundryWorkload || {
    submitted: 3,
    washing: 7,
    ready: 2,
    avgTurnaroundHours: 36.0,
    onTimePercentage: 94,
  };
  const alerts = data?.alerts || [
    { facility: "Mess - Counter 1", message: "Dinner 8:00–8:15 runs at 2.2x average capacity. Consider another serving counter." },
    { facility: "Laundry Room", message: "7 bags currently in active wash cycle. Estimated queue clearance on schedule." },
  ];
  const dishImpact = data?.dishImpact || [
    { dish_name: "Achari aloo & kala chana", expected_prep_time_minutes: 5, meal_name: "Dinner", avg_duration_minutes: 30 },
    { dish_name: "Kadhai paneer & veg biryani", expected_prep_time_minutes: 5, meal_name: "Dinner", avg_duration_minutes: 30 },
    { dish_name: "Kurkure bhindi & lobia masala", expected_prep_time_minutes: 3, meal_name: "Lunch", avg_duration_minutes: 28 },
    { dish_name: "Aloo paratha & curd", expected_prep_time_minutes: 2, meal_name: "Breakfast", avg_duration_minutes: 22 },
  ];

  return (
    <section className="screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrative Intelligence</p>
          <h1>Admin Overview</h1>
        </div>
        <span className="admin-badge">HostelFlow Admin · Block A</span>
      </header>

      <div className="admin-kpi-banner">
        <p className="eyebrow" style={{ color: "var(--sage)" }}>Live Facility Load</p>
        <h2>{headline.displayString}</h2>
        <p>Real-time analytics computed directly via SQL aggregation over stored visits.</p>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <p className="eyebrow">Laundry Workload (DBMS Objective 7)</p>
          <h3>Active Queue & Delivery</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
            <div style={{ padding: "12px", background: "var(--paper)", borderRadius: "12px" }}>
              <small style={{ color: "var(--ink-soft)", fontSize: "10px" }}>SUBMITTED</small>
              <strong style={{ display: "block", fontSize: "22px", marginTop: "4px" }}>{laundry.submitted}</strong>
            </div>
            <div style={{ padding: "12px", background: "var(--terracotta-soft)", borderRadius: "12px" }}>
              <small style={{ color: "var(--ink-soft)", fontSize: "10px" }}>WASHING</small>
              <strong style={{ display: "block", fontSize: "22px", marginTop: "4px" }}>{laundry.washing}</strong>
            </div>
            <div style={{ padding: "12px", background: "var(--sage-light)", borderRadius: "12px" }}>
              <small style={{ color: "var(--ink-soft)", fontSize: "10px" }}>READY</small>
              <strong style={{ display: "block", fontSize: "22px", marginTop: "4px" }}>{laundry.ready}</strong>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--ink-soft)", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <span>Avg Turnaround: <strong>{laundry.avgTurnaroundHours}h</strong></span>
            <span>On-time Rate: <strong>{laundry.onTimePercentage}%</strong></span>
          </div>
        </div>

        <div className="admin-card">
          <p className="eyebrow">Queue Bottleneck Alerts</p>
          <h3>Actionable Recommendations</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {alerts.map((alert, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: "10px", background: "var(--paper)", borderLeft: "3px solid var(--terracotta)", fontSize: "11px" }}>
                <strong style={{ display: "block", color: "var(--ink)" }}>{alert.facility}</strong>
                <span style={{ color: "var(--ink-soft)" }}>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: "22px" }}>
        <p className="eyebrow">Synopsis 4.2 Impact Analysis</p>
        <h3>Dish Serving Speed Impact on Mess Duration</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Dish Name</th>
              <th>Meal</th>
              <th>Prep Time</th>
              <th>Total Duration</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {dishImpact.map((dish, idx) => (
              <tr key={idx}>
                <td><strong>{dish.dish_name}</strong></td>
                <td>{dish.meal_name}</td>
                <td>~{dish.expected_prep_time_minutes} min</td>
                <td>{dish.avg_duration_minutes} min</td>
                <td>
                  <span className={`status ${dish.expected_prep_time_minutes >= 5 ? "status--busy" : "status--quiet"}`}>
                    {dish.expected_prep_time_minutes >= 5 ? "Slows Queue" : "Fast Turnover"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {heatmap && (
        <div className="admin-card">
          <p className="eyebrow">30-Day Heatmap (Days × Meals)</p>
          <h3>Crowd Density Distribution</h3>
          <table className="heatmap-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: "var(--ink-soft)" }}>Day</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>High Tea</th>
                <th>Dinner</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(heatmap).map(([day, meals]) => (
                <tr key={day}>
                  <td><strong>{day}</strong></td>
                  {["Breakfast", "Lunch", "High Tea", "Dinner"].map((meal) => {
                    const count = meals[meal] || 0;
                    const levelClass = count > 100 ? "heatmap-cell--high" : count > 50 ? "heatmap-cell--med" : "heatmap-cell--low";
                    return (
                      <td key={meal} className={`heatmap-cell ${levelClass}`}>
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LaundryStaffConsole() {
  const [queue, setQueue] = useState<
    Array<{
      request_id: number;
      bag_number: string;
      student_name: string;
      roll_no: string;
      room_no: string;
      hostel_name: string;
      submitted_datetime: string;
      status: string;
    }>
  >([]);
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchQueue = () => {
    api.getLaundryQueue().then((data) => {
      if (data) setQueue(data);
    });
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleUpdate = async (requestId: number, newStatus: string, bagNumber: string) => {
    const res = await api.updateLaundryStatus(requestId, newStatus);
    if (res && res.success) {
      setToast(`Bag ${bagNumber} moved to ${newStatus}`);
      setTimeout(() => setToast(null), 4000);
      fetchQueue();
    }
  };

  const filtered = queue.filter(
    (b) =>
      b.bag_number.toLowerCase().includes(filter.toLowerCase()) ||
      b.student_name.toLowerCase().includes(filter.toLowerCase()) ||
      b.roll_no.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section className="screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Service Operations Desk</p>
          <h1>Laundry Console</h1>
        </div>
        <span className="paper-tag paper-tag--large">Staff View</span>
      </header>

      {toast && (
        <div style={{ padding: "12px 18px", background: "var(--sage-light)", color: "var(--ink)", borderRadius: "12px", marginBottom: "18px", fontWeight: 700, fontSize: "12px" }}>
          ✓ {toast}
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <strong>Active Queue: {queue.length} Bags</strong>
            <p style={{ margin: "2px 0 0", color: "var(--ink-soft)", fontSize: "11px" }}>Bags arranged in strict submission order (FIFO queue)</p>
          </div>
          <input
            placeholder="Search bag or student..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "12px" }}
          />
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bag #</th>
              <th>Student</th>
              <th>Room</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Queue Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--ink-soft)" }}>No active bags in queue.</td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.request_id}>
                  <td><span className="paper-tag">{item.bag_number}</span></td>
                  <td>
                    <strong>{item.student_name}</strong>
                    <small style={{ display: "block", color: "var(--ink-soft)", fontSize: "10px" }}>{item.roll_no}</small>
                  </td>
                  <td>{item.hostel_name} · {item.room_no}</td>
                  <td style={{ fontSize: "11px", color: "var(--ink-soft)" }}>{item.submitted_datetime?.slice(5, 16)}</td>
                  <td>
                    <span className={`status ${item.status === "WASHING" ? "status--busy" : item.status === "READY" ? "status--quiet" : "status--live"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.status === "SUBMITTED" && (
                      <button className="staff-action-btn" onClick={() => handleUpdate(item.request_id, "WASHING", item.bag_number)}>
                        Start Wash →
                      </button>
                    )}
                    {item.status === "WASHING" && (
                      <button className="staff-action-btn" onClick={() => handleUpdate(item.request_id, "READY", item.bag_number)}>
                        Mark Ready ✓
                      </button>
                    )}
                    {item.status === "READY" && (
                      <button className="staff-action-btn staff-action-btn--secondary" onClick={() => handleUpdate(item.request_id, "RECEIVED", item.bag_number)}>
                        Deliver / Done
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MessEntranceStandee() {
  return (
    <section className="screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Entrance Poster</p>
          <h1>Mess Entrance QR</h1>
        </div>
        <span className="paper-tag paper-tag--large">Block A Standee</span>
      </header>

      <article className="admin-card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <p className="eyebrow">JK Lakshmipat University · Dining Hall</p>
        <h2 style={{ fontSize: "28px", margin: "10px 0 6px" }}>Scan to Enter the Mess</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: "13px", maxWidth: "420px", margin: "0 auto 24px" }}>
          Point your phone camera or the HostelFlow scanner at this QR code. The system auto-detects the meal and records your entry.
        </p>

        <div style={{
          display: "inline-block",
          padding: "20px",
          background: "white",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(31, 45, 56, 0.12)",
          border: "2px solid var(--border)",
          marginBottom: "24px"
        }}>
          <img
            src="/mess-qr-code.svg"
            alt="Mess Entrance QR Code"
            width={240}
            height={240}
            style={{ display: "block" }}
          />
          <span style={{ display: "block", marginTop: "12px", fontFamily: "JetBrains Mono", fontSize: "11px", color: "var(--ink-soft)" }}>
            HOSTELFLOW_MESS_ENTRANCE_BLOCK_A
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", maxWidth: "480px", margin: "0 auto" }}>
          <span className="glass-chip">Breakfast 8:00–9:00 AM</span>
          <span className="glass-chip">Lunch 11:30–2:00 PM</span>
          <span className="glass-chip">High Tea 5:00–6:00 PM</span>
          <span className="glass-chip">Dinner 8:00–10:00 PM</span>
        </div>

        <p style={{ margin: "24px 0 0", color: "var(--sage)", fontSize: "12px", fontWeight: 700 }}>
          ✓ Single Scan Entrance • No Exit Scan Required • Auto Meal Window
        </p>
      </article>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [scanning, setScanning] = useState(false);
  const [authStage, setAuthStage] = useState<AuthStage>("login");
  const [currentStudent, setCurrentStudent] = useState({
    name: "Shouryaveer Bishnoi",
    rollNo: "2025BTECH111",
    hostelName: "Block A",
    roomNo: "214",
    phone: "+91 98765 43240",
    bagNumber: "B-214",
  });

  const studentInitials = currentStudent.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const studentFirstName = currentStudent.name.split(" ")[0];

  if (authStage !== "app") {
    return (
      <AuthFlow
        stage={authStage}
        setStage={setAuthStage}
        onStaffSignIn={() => {
          setAuthStage("app");
          setView("admin");
        }}
        onStudentAuthenticated={(stu) => {
          setCurrentStudent((prev) => ({ ...prev, ...stu }));
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Brand />
        <p className="sidebar-label">Student space</p>
        <nav>
          {navItems.map((item) => (
            <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)} type="button">
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="sidebar-label" style={{ marginTop: "24px" }}>Campus & Staff</p>
        <nav>
          <button className={view === "qr" ? "active" : ""} onClick={() => setView("qr")} type="button">
            <Icon name="scan" /><span>Mess QR Poster</span>
          </button>
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")} type="button">
            <Icon name="calendar" /><span>Admin Analytics</span>
          </button>
          <button className={view === "staff" ? "active" : ""} onClick={() => setView("staff")} type="button">
            <Icon name="bag" /><span>Laundry Staff</span>
          </button>
        </nav>
        <div className="sidebar-user">
          <span>{studentInitials}</span>
          <div><strong>{studentFirstName}</strong><small>{currentStudent.hostelName} · {currentStudent.roomNo}</small></div>
        </div>
      </aside>

      <main>
        {view === "home" && <Home onNavigate={setView} onScan={() => setScanning(true)} student={currentStudent} />}
        {view === "mess" && <Mess />}
        {view === "laundry" && <Laundry student={currentStudent} />}
        {view === "profile" && <Profile student={currentStudent} onLogout={() => { setView("home"); setAuthStage("login"); }} />}
        {view === "qr" && <MessEntranceStandee />}
        {view === "admin" && <AdminDashboard />}
        {view === "staff" && <LaundryStaffConsole />}
      </main>

      <nav className="bottom-nav">
        {navItems.slice(0, 2).map((item) => (
          <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)} type="button"><Icon name={item.icon} /><span>{item.label}</span></button>
        ))}
        <button className="scan-button" aria-label="Scan mess QR" onClick={() => setScanning(true)} type="button"><Icon name="scan" size={25} /></button>
        {navItems.slice(2).map((item) => (
          <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)} type="button"><Icon name={item.icon} /><span>{item.label}</span></button>
        ))}
      </nav>
      {scanning && <ScanModal onClose={() => setScanning(false)} student={currentStudent} />}
    </div>
  );
}
