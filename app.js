const OFFICIAL_COMPLAINT_FORM_URL =
  "https://www.gov.il/he/service/complaint_about_conduct_in_public_transportation";

const STORAGE_KEY = "publicTransportComplaintCases";

const fields = [
  "transportType",
  "lineNumber",
  "operator",
  "originCity",
  "destination",
  "stationName",
  "eventDate",
  "plannedTime",
  "issueType",
  "damage",
  "description",
  "contactName",
  "contactPhone",
];

const requiredFields = [
  "lineNumber",
  "operator",
  "originCity",
  "destination",
  "stationName",
  "eventDate",
  "plannedTime",
  "issueType",
  "damage",
  "description",
];

const labels = {
  transportType: "סוג תחבורה",
  lineNumber: "מספר קו",
  operator: "חברה מפעילה",
  originCity: "עיר מוצא",
  destination: "יעד",
  stationName: "מספר / שם תחנה",
  eventDate: "תאריך האירוע",
  plannedTime: "שעה מתוכננת",
  issueType: "סוג תקלה",
  damage: "נזק שנגרם",
  description: "תיאור נוסף",
  contactName: "שם הפונה",
  contactPhone: "טלפון",
};

const knownOperators = [
  "אגד תעבורה",
  "אלקטרה אפיקים",
  "בית שמש אקספרס",
  "נתיב אקספרס",
  "דן בדרום",
  "דן באר שבע",
  "מטרופולין",
  "סופרבוס",
  "תנופה",
  "קווים",
  "אקסטרה",
  "אפיקים",
  "אגד",
  "דן",
  "גלים",
];

const knownCities = [
  "ירושלים",
  "בית שמש",
  "תל אביב",
  "חיפה",
  "בני ברק",
  "פתח תקווה",
  "ראשון לציון",
  "מודיעין עילית",
  "מודיעין",
  "ביתר עילית",
  "אשדוד",
  "אשקלון",
  "באר שבע",
  "נתניה",
  "רחובות",
  "רמת גן",
  "גבעתיים",
  "חולון",
  "בת ים",
  "הרצליה",
  "כפר סבא",
  "רעננה",
  "לוד",
  "רמלה",
  "אלעד",
  "קריית גת",
  "קריית מלאכי",
  "טבריה",
  "צפת",
  "עפולה",
  "נצרת",
  "אריאל",
];

const routeKnowledge = {
  "618": {
    operators: ["בית שמש אקספרס", "אגד"],
    directions: [
      { origin: "בית שמש", destination: "ירושלים", label: "בית שמש ← ירושלים" },
      { origin: "ירושלים", destination: "בית שמש", label: "ירושלים ← בית שמש" },
    ],
    origins: ["בית שמש", "ירושלים"],
    destinations: ["ירושלים", "בית שמש"],
    stations: ["5430"],
    stationStops: [
      {
        value: "5430",
        label: "5430 - בית שמש, לכיוון ירושלים",
        origin: "בית שמש",
        destination: "ירושלים",
      },
    ],
  },
  "947": {
    operators: ["אגד"],
    directions: [
      { origin: "חיפה", destination: "תל אביב", label: "חיפה ← תל אביב" },
      { origin: "תל אביב", destination: "חיפה", label: "תל אביב ← חיפה" },
    ],
    origins: ["חיפה", "תל אביב", "נתניה"],
    destinations: ["תל אביב", "חיפה", "נתניה"],
    stations: ["מרכזית חוף הכרמל", "תחנה מרכזית תל אביב"],
    stationStops: [
      {
        value: "מרכזית חוף הכרמל",
        label: "מרכזית חוף הכרמל - חיפה, לכיוון תל אביב",
        origin: "חיפה",
        destination: "תל אביב",
      },
      {
        value: "תחנה מרכזית תל אביב",
        label: "תחנה מרכזית תל אביב - תל אביב, לכיוון חיפה",
        origin: "תל אביב",
        destination: "חיפה",
      },
    ],
  },
};

let currentCase = {};
let latestAnalysis = {};
let tripContext = {
  lineNumber: "",
  operator: "",
  originCity: "",
  destination: "",
  stationName: "",
};

const getElement = (id) => document.getElementById(id);

function setStep(step) {
  document.querySelectorAll("[data-step]").forEach((section) => {
    section.classList.toggle("is-hidden", section.dataset.step !== String(step));
  });

  document.querySelectorAll("[data-step-marker]").forEach((marker) => {
    marker.classList.toggle("is-active", marker.dataset.stepMarker === String(step));
  });
}

function normalizeText(text) {
  return text
    .replace(/[־–—]/g, "-")
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getYesterdayValue() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateForInput(yesterday);
}

function getHistoryValues(field) {
  return uniqueValues(getHistory().map((item) => item[field])).slice(0, 8);
}

function getCurrentLineNumber() {
  return (
    getElement("lineNumber")?.value.trim() ||
    tripContext.lineNumber ||
    latestAnalysis?.data?.lineNumber ||
    ""
  );
}

function getHistoryByLine(lineNumber, field) {
  if (!lineNumber) return [];
  return uniqueValues(
    getHistory()
      .filter((item) => item.lineNumber === lineNumber)
      .map((item) => item[field])
  );
}

function getCurrentRouteDirection() {
  return {
    origin:
      getElement("originCity")?.value.trim() ||
      tripContext.originCity ||
      latestAnalysis?.data?.originCity ||
      "",
    destination:
      getElement("destination")?.value.trim() ||
      tripContext.destination ||
      latestAnalysis?.data?.destination ||
      "",
  };
}

function stationMatchesDirection(station, route) {
  if (!route.origin && !route.destination) return true;
  if (route.origin && station.origin && station.origin !== route.origin) return false;
  if (route.destination && station.destination && station.destination !== route.destination) return false;
  return true;
}

function getLineContext(lineNumber) {
  const known = routeKnowledge[lineNumber] || {};
  const route = getCurrentRouteDirection();
  const historyDirections = getHistory()
    .filter((item) => item.lineNumber === lineNumber && item.originCity && item.destination)
    .map((item) => ({
      origin: item.originCity,
      destination: item.destination,
      label: `${item.originCity} ← ${item.destination}`,
    }));
  const knownStationStops = (known.stationStops || []).filter((station) =>
    stationMatchesDirection(station, route)
  );
  const historyStationStops = getHistory()
    .filter((item) => {
      if (item.lineNumber !== lineNumber || !item.stationName) return false;
      if (route.origin && item.originCity && item.originCity !== route.origin) return false;
      if (route.destination && item.destination && item.destination !== route.destination) return false;
      return true;
    })
    .map((item) => ({
      value: item.stationName,
      label: item.originCity || item.destination
        ? `${item.stationName} - ${item.originCity || "מוצא לא ידוע"} ← ${item.destination || "יעד לא ידוע"}`
        : item.stationName,
      origin: item.originCity,
      destination: item.destination,
    }));
  const stationStops = [...knownStationStops, ...historyStationStops].filter(
    (station, index, all) => all.findIndex((item) => item.value === station.value) === index
  );

  return {
    operators: uniqueValues([...(known.operators || []), ...getHistoryByLine(lineNumber, "operator")]),
    directions: [...(known.directions || []), ...historyDirections].filter(
      (direction, index, all) =>
        all.findIndex(
          (item) => item.origin === direction.origin && item.destination === direction.destination
        ) === index
    ),
    origins: uniqueValues([...(known.origins || []), ...getHistoryByLine(lineNumber, "originCity")]),
    destinations: uniqueValues([
      ...(known.destinations || []),
      ...getHistoryByLine(lineNumber, "destination"),
    ]),
    stationStops,
    stations: uniqueValues([
      ...stationStops.map((station) => station.value),
      ...(known.stations || []),
      ...getHistoryByLine(lineNumber, "stationName"),
    ]),
  };
}

function setDatalistOptions(id, values) {
  const datalist = getElement(id);
  if (!datalist) return;

  datalist.innerHTML = "";
  uniqueValues(values).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    datalist.appendChild(option);
  });
}

function refreshSuggestionSources() {
  const lineContext = getLineContext(getCurrentLineNumber());
  setDatalistOptions("operatorSuggestions", uniqueValues([...lineContext.operators, ...knownOperators]));
  setDatalistOptions("citySuggestions", uniqueValues([
    ...lineContext.origins,
    ...lineContext.destinations,
    ...knownCities,
  ]));
  setDatalistOptions("lineSuggestions", uniqueValues([
    ...Object.keys(routeKnowledge),
    ...getHistoryValues("lineNumber"),
  ]));
  setDatalistOptions("stationSuggestions", uniqueValues([
    ...lineContext.stations,
    ...getHistoryValues("stationName"),
  ]));
}

function parseDate(text) {
  const today = new Date();
  const normalized = normalizeText(text);
  const numericDate = normalized.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);

  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]) - 1;
    const yearPart = numericDate[3] ? Number(numericDate[3]) : today.getFullYear();
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    return formatDateForInput(new Date(year, month, day));
  }

  if (normalized.includes("היום")) {
    return formatDateForInput(today);
  }

  if (normalized.includes("אתמול")) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return formatDateForInput(yesterday);
  }

  return "";
}

function cleanExtractedValue(value) {
  return (value || "")
    .replace(/^[\s,.:;]+|[\s,.:;]+$/g, "")
    .replace(/^(?:ה|ב|ל|מ|מה|אל|של)\s+/g, "")
    .replace(/\s+(?:היום|אתמול|בתאריך|בשעה|ב-\d{1,2}:\d{2}).*$/g, "")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanExtractedValue(match[1]);
  }
  return "";
}

function parseLineNumber(text) {
  const value = firstMatch(text, [
    /(?:קו|ק[ו']?|אוטובוס|מספר\s+קו)\s*(\d{1,4}[א-ת]?)/,
    /(?:עליתי|חיכיתי|נסעתי)\s+(?:ל)?(?:קו\s*)?(\d{1,4}[א-ת]?)/,
  ]);

  const compactDateWord = value.match(/^(\d{1,4})(?:היום|אתמול)$/);
  if (compactDateWord) return compactDateWord[1];

  const invalidHebrewSuffix = value.match(/^(\d{1,4})([א-ת])$/);
  if (invalidHebrewSuffix && /^(?:היום|אתמול)/.test(text.slice(text.indexOf(value) + invalidHebrewSuffix[1].length))) {
    return invalidHebrewSuffix[1];
  }

  return value;
}

function parseTime(text) {
  const match = text.match(/(?:בשעה|סביב|בערך|ב-)?\s*(\d{1,2}:\d{2})/);
  if (!match) return "";

  const [hour, minute] = match[1].split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

function parseOperator(text) {
  const explicit = firstMatch(text, [
    /(?:חברת|חברה|מפעיל[ה]?|של חברת)\s+([א-ת\s"'-]+?)(?=\s+(?:קו|בקו|בתחנת|בתחנה|בשעה|מ|ל|ש|היום|אתמול|$))/,
  ]);

  if (explicit) return explicit;

  return knownOperators.find((operator) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(operator)}(\\s|$)`);
    return pattern.test(text);
  }) || "";
}

function parseRoute(text) {
  const stationRoute = text.match(
    /([א-ת\s"'-]{2,50})\s+תחנה\s+\d{3,6}\s*ל([א-ת\s"'-]+?)(?=\s+קו|\s+אוטובוס|\s+היום|\s+אתמול|$)/
  );
  if (stationRoute?.[1] && stationRoute?.[2]) {
    const originWords = stationRoute[1]
      .trim()
      .split(/\s+/)
      .slice(-2)
      .join(" ");

    return {
      originCity: cleanExtractedValue(originWords),
      destination: cleanExtractedValue(stationRoute[2]),
    };
  }

  const routePatterns = [
    /(?:^|\s)מ([א-ת\s"'-]+?)\s+ל([א-ת\s"'-]+?)(?=\s+(?:עבר|לא|איחר|הגיע|יצא|נסע|בתחנת|בתחנה|בשעה|ב-\d|היום|אתמול|בתאריך|$))/,
    /(?:^|\s)מ([א-ת\s"'-]+?)\s+(?:אל|לכיוון|עד)\s+([א-ת\s"'-]+?)(?=\s+(?:עבר|לא|איחר|הגיע|יצא|נסע|בתחנת|בתחנה|בשעה|ב-\d|היום|אתמול|בתאריך|$))/,
    /(?:^|\s)בין\s+([א-ת\s"'-]+?)\s+(?:לבין|ל)\s+([א-ת\s"'-]+?)(?=\s+(?:עבר|לא|איחר|הגיע|יצא|נסע|בתחנת|בתחנה|בשעה|ב-\d|היום|אתמול|בתאריך|$))/,
    /(?:^|\s)([א-ת][א-ת\s"'-]+?)\s+תחנה\s+\d+\s*ל([א-ת\s"'-]+?)(?=\s+(?:עבר|לא|איחר|הגיע|יצא|נסע|בשעה|ב-\d|היום|אתמול|בתאריך|$))/,
  ];

  for (const pattern of routePatterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        originCity: cleanExtractedValue(match[1]),
        destination: cleanExtractedValue(match[2]),
      };
    }
  }

  return { originCity: "", destination: "" };
}

function parseStation(text) {
  const stationNumber = text.match(/(?:תחנה|בתחנה|בתחנת|מספר\s+תחנה)\s*(\d{3,6})/);
  if (stationNumber) return stationNumber[1];

  const stationName = firstMatch(text, [
    /(?:בתחנת|בתחנה|תחנת|מהתחנה)\s+([א-ת0-9\s"'-]+?)(?=\s+(?:ולא|לא|עבר|חלף|הגיע|בשעה|סביב|בסביבות|ב-\d|למרות|כאשר|כש|שהיו|היום|אתמול|בתאריך|$))/,
    /(?:תחנה\s+בשם)\s+([א-ת0-9\s"'-]+?)(?=\s+(?:ולא|לא|עבר|הגיע|בשעה|ב-\d|$))/,
  ]);

  if (/^(?:סביב|בסביבות|בשעה|ב-\d)/.test(stationName)) return "";
  return stationName;
}

function parseIssueType(text) {
  const issueRules = [
    {
      value: "האוטובוס עבר ולא עצר",
      patterns: [
        /עבר.{0,30}לא\s+עצר/,
        /חלף.{0,30}לא\s+עצר/,
        /דילג\s+על\s+התחנה/,
        /לא\s+עצר\s+בתחנה/,
        /האוטובוס\s+לא\s+עצר/,
      ],
    },
    {
      value: "האוטובוס הגיע מלא ולא העלה נוסעים",
      patterns: [/מלא.{0,30}לא\s+העלה/, /לא\s+העלה.{0,30}נוסעים/, /היה\s+מלא/, /מפוצץ/],
    },
    {
      value: "האוטובוס לא הגיע",
      patterns: [/לא\s+הגיע/, /לא\s+בא/, /לא\s+יצא/, /בוטל/, /לא\s+הופיע/],
    },
    {
      value: "איחור חריג",
      patterns: [/איחור/, /איחר/, /מאחר/, /התעכב/, /הגיע\s+באיחור/, /חיכיתי\s+\d+\s+דקות/],
    },
    {
      value: "שירות לא תקין",
      patterns: [/נהג/, /שירות/, /התנהגות/, /מזגן/, /ניקיון/, /דלת/, /סירב/, /צעק/],
    },
  ];

  const rule = issueRules.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(text))
  );

  return rule?.value || "";
}

function parseDamage(text) {
  const damageRules = [
    { value: "איחור לעבודה", patterns: [/איחרתי\s+לעבודה/, /לעבודה/, /משמרת/] },
    {
      value: "איחור ללימודים",
      patterns: [
        /איחר(?:תי|ה|נו|תם|תן)?\s+ל(?:לימודים|בית\s*ספר|מוסד\s+לימודי|מוסד\s+הלימודי)/,
        /למוסד\s+הלימודי/,
        /מוסד\s+לימודי/,
        /לימודים/,
        /בית\s*ספר/,
        /אוניברסיטה/,
        /מכללה/,
      ],
    },
    { value: "צורך במונית", patterns: [/מונית/, /טקסי/, /לקחתי\s+מונית/, /נאלצתי\s+לקחת/] },
    { value: "המתנה ממושכת", patterns: [/המתנה/, /חיכיתי/, /חיכינו/, /נשארתי\s+בתחנה/, /נאלצתי\s+להמתין/] },
    { value: "החמצת תור או פגישה", patterns: [/תור/, /פגישה/, /ראיון/, /בדיקה/] },
  ];

  const rule = damageRules.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(text))
  );

  return rule?.value || "";
}

function buildAnalysisSummary(data) {
  const found = requiredFields
    .filter((field) => data[field])
    .map((field) => `${labels[field]}: ${data[field]}`);

  return {
    found,
    missing: getMissingFields(data),
    intent: data.issueType || "לא זוהתה תקלה חד-משמעית",
    data,
  };
}

function renderAnalysisSummary(analysis) {
  const wrapper = getElement("analysisSummary");
  wrapper.innerHTML = "";

  const title = document.createElement("p");
  title.textContent = `זיהוי כוונה: ${analysis.intent}`;
  wrapper.appendChild(title);

  if (analysis.found.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "לא זוהו עדיין פרטים ברורים מתוך הטקסט. אפשר להשלים ידנית בשדות.";
    wrapper.appendChild(empty);
    return;
  }

  const list = document.createElement("ul");
  analysis.found.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.appendChild(entry);
  });
  wrapper.appendChild(list);
}

function syncTripContextFromForm() {
  tripContext = {
    lineNumber: getElement("lineNumber")?.value.trim() || "",
    operator: getElement("operator")?.value.trim() || "",
    originCity: getElement("originCity")?.value.trim() || "",
    destination: getElement("destination")?.value.trim() || "",
    stationName: getElement("stationName")?.value.trim() || "",
  };
}

function applyTripContext(updates) {
  tripContext = { ...tripContext, ...updates };

  Object.entries(updates).forEach(([field, value]) => {
    const input = getElement(field);
    if (input) input.value = value || "";
  });

  refreshSuggestionSources();
  updateMissingHighlights();
}

function getStatusText(value) {
  return value ? "נבחר" : "חסר";
}

function createDecisionCard({ title, value, emptyText, helper, options, onSelect }) {
  const card = document.createElement("article");
  card.className = "decision-card";
  if (!value) card.classList.add("needs-choice");

  const header = document.createElement("div");
  header.className = "decision-card-header";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const status = document.createElement("span");
  status.className = "decision-status";
  status.textContent = getStatusText(value);

  header.append(heading, status);
  card.appendChild(header);

  const current = document.createElement("p");
  current.className = "decision-current";
  current.textContent = value || emptyText;
  card.appendChild(current);

  if (helper) {
    const help = document.createElement("p");
    help.className = "decision-helper";
    help.textContent = helper;
    card.appendChild(help);
  }

  if (options.length > 0) {
    const chips = document.createElement("div");
    chips.className = "decision-options";

    options.slice(0, 8).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "decision-option";
      button.textContent = option.label || option.value || option;
      button.addEventListener("click", () => onSelect(option));
      chips.appendChild(button);
    });

    card.appendChild(chips);
  }

  return card;
}

function renderTripContextPanel() {
  const panel = getElement("tripContextPanel");
  if (!panel) return;

  const data = readForm();
  tripContext = {
    lineNumber: data.lineNumber,
    operator: data.operator,
    originCity: data.originCity,
    destination: data.destination,
    stationName: data.stationName,
  };

  const lineContext = getLineContext(data.lineNumber);
  const directionValue =
    data.originCity && data.destination ? `${data.originCity} ← ${data.destination}` : "";
  const knownLineOptions = uniqueValues([...Object.keys(routeKnowledge), ...getHistoryValues("lineNumber")]);

  panel.innerHTML = "";

  const title = document.createElement("div");
  title.className = "trip-context-title";
  title.innerHTML = `<h3>בדיקת פרטי נסיעה</h3><p>בחרו את הפרטים המחוברים זה לזה. הטופס מתעדכן מתחת.</p>`;
  panel.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "decision-grid";

  grid.appendChild(
    createDecisionCard({
      title: "קו",
      value: data.lineNumber,
      emptyText: "לא זוהה מספר קו",
      helper: "מספר הקו קובע אילו כיוונים, תחנות וחברות אפשר להציע.",
      options: knownLineOptions.map((value) => ({ value, label: `קו ${value}` })),
      onSelect: (option) => applyTripContext({ lineNumber: option.value }),
    })
  );

  grid.appendChild(
    createDecisionCard({
      title: "כיוון נסיעה",
      value: directionValue,
      emptyText: data.lineNumber ? "בחרו כיוון לקו" : "בחרו קודם קו",
      helper: "בחירת כיוון ממלאת יחד את עיר המוצא והיעד.",
      options: data.lineNumber ? lineContext.directions : [],
      onSelect: (option) =>
        applyTripContext({
          originCity: option.origin,
          destination: option.destination,
        }),
    })
  );

  grid.appendChild(
    createDecisionCard({
      title: "תחנה",
      value: data.stationName,
      emptyText: data.lineNumber ? "בחרו מספר / שם תחנה" : "בחרו קודם קו",
      helper: "התחנות מסוננות לפי הקו, ואם יש כיוון אז גם לפי הכיוון.",
      options:
        lineContext.stationStops.length > 0
          ? lineContext.stationStops
          : lineContext.stations.map((value) => ({ value, label: value })),
      onSelect: (option) => applyTripContext({ stationName: option.value || option }),
    })
  );

  grid.appendChild(
    createDecisionCard({
      title: "חברה מפעילה",
      value: data.operator,
      emptyText: data.lineNumber ? "בחרו חברה אפשרית" : "בחרו קודם קו או הקלידו ידנית",
      helper: "החברה מוצעת לפי הקו והיסטוריה מקומית.",
      options: lineContext.operators.map((value) => ({ value, label: value })),
      onSelect: (option) => applyTripContext({ operator: option.value }),
    })
  );

  panel.appendChild(grid);
}

function getFieldOptions(field, data) {
  const lineContext = getLineContext(data.lineNumber);
  const optionMap = {
    lineNumber: uniqueValues([...Object.keys(routeKnowledge), ...getHistoryValues("lineNumber")]).map(
      (value) => ({ label: `קו ${value}`, updates: { lineNumber: value } })
    ),
    eventDate: [
      { label: "היום", updates: { eventDate: formatDateForInput(new Date()) } },
      { label: "אתמול", updates: { eventDate: getYesterdayValue() } },
    ],
    issueType: [
      "האוטובוס לא הגיע",
      "האוטובוס עבר ולא עצר",
      "האוטובוס הגיע מלא ולא העלה נוסעים",
      "איחור חריג",
      "שירות לא תקין",
      "אחר",
    ].map((value) => ({ label: value, updates: { issueType: value } })),
    damage: [
      "איחור לעבודה",
      "איחור ללימודים",
      "צורך במונית",
      "המתנה ממושכת",
      "החמצת תור או פגישה",
      "אחר",
    ].map((value) => ({ label: value, updates: { damage: value } })),
    routeDirection: lineContext.directions.map((direction) => ({
      label: direction.label,
      updates: {
        originCity: direction.origin,
        destination: direction.destination,
      },
    })),
    stationName: (
      lineContext.stationStops.length > 0
        ? lineContext.stationStops
        : lineContext.stations.map((value) => ({ value, label: value }))
    ).map((station) => ({
      label: station.label || station.value,
      updates: { stationName: station.value },
    })),
    operator: lineContext.operators.map((value) => ({ label: value, updates: { operator: value } })),
  };

  return optionMap[field] || [];
}

function getNextGuidedQuestion(data, missingFields) {
  if (missingFields.includes("lineNumber")) {
    return {
      field: "lineNumber",
      title: "איזה קו זה היה?",
      helper: "מספר הקו עוזר לנו להציע כיוון, תחנות וחברה.",
      manualLabel: "מספר קו",
      manualType: "text",
    };
  }

  if (missingFields.includes("eventDate")) {
    return {
      field: "eventDate",
      title: "מתי זה קרה?",
      helper: "אם זה לא היום או אתמול, אפשר להזין תאריך בשדה.",
      manualLabel: "תאריך אחר",
      manualType: "date",
    };
  }

  if (missingFields.includes("plannedTime")) {
    return {
      field: "plannedTime",
      title: "באיזו שעה זה קרה או היה אמור לקרות?",
      helper: "השעה עוזרת לאתר את הנסיעה המתוכננת.",
      manualLabel: "שעה",
      manualType: "time",
    };
  }

  if (missingFields.includes("issueType")) {
    return {
      field: "issueType",
      title: "איזו תקלה קרתה?",
      helper: "בחרו את האפשרות הכי קרובה למה שקרה בפועל.",
    };
  }

  if (missingFields.includes("originCity") || missingFields.includes("destination")) {
    return {
      field: "routeDirection",
      title: data.lineNumber ? `לאיזה כיוון נסע קו ${data.lineNumber}?` : "מה היה כיוון הנסיעה?",
      helper: "בחירה אחת ממלאת גם עיר מוצא וגם יעד.",
      manualLabel: "מלאו מוצא ויעד בעריכה המתקדמת",
    };
  }

  if (missingFields.includes("stationName")) {
    return {
      field: "stationName",
      title: "באיזו תחנה זה קרה?",
      helper: data.lineNumber
        ? "אם יש הצעות, הן מסוננות לפי הקו והכיוון. עדיף לבחור מספר תחנה אם ידוע."
        : "אפשר להקליד מספר תחנה או שם תחנה.",
      manualLabel: "מספר / שם תחנה",
      manualType: "text",
    };
  }

  if (missingFields.includes("operator")) {
    return {
      field: "operator",
      title: "איזו חברה מפעילה?",
      helper: "אם לא בטוחים, אפשר לבחור הצעה לפי הקו או להשלים בהמשך בטופס הרשמי.",
      manualLabel: "חברה מפעילה",
      manualType: "text",
    };
  }

  if (missingFields.includes("damage")) {
    return {
      field: "damage",
      title: "מה הנזק שנגרם?",
      helper: "זה יעזור לנסח תלונה ממוקדת וברורה.",
    };
  }

  if (missingFields.includes("description")) {
    return {
      field: "description",
      title: "האם יש תיאור קצר של מה שקרה?",
      helper: "משפט עובדתי אחד מספיק בשלב הזה.",
      manualLabel: "תיאור",
      manualType: "text",
    };
  }

  return null;
}

function renderGuidedAssistant(data, missingFields) {
  const wrapper = getElement("guidedAssistant");
  if (!wrapper) return;

  const readyCount = requiredFields.length - missingFields.length;
  const question = getNextGuidedQuestion(data, missingFields);

  wrapper.innerHTML = "";

  const header = document.createElement("div");
  header.className = "guided-header";

  const title = document.createElement("h3");
  title.textContent = "השלמת פרטים חסרים";

  const progress = document.createElement("span");
  progress.className = "guided-progress";
  progress.textContent = `${readyCount}/${requiredFields.length} פרטים מוכנים`;

  header.append(title, progress);
  wrapper.appendChild(header);

  const meter = document.createElement("div");
  meter.className = "guided-meter";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round((readyCount / requiredFields.length) * 100)}%`;
  meter.appendChild(fill);
  wrapper.appendChild(meter);

  if (!question) {
    const done = document.createElement("p");
    done.className = "guided-done";
    done.textContent = "כל פרטי החובה מוכנים. אפשר להכין חבילת הגשה.";
    wrapper.appendChild(done);
    return;
  }

  const card = document.createElement("div");
  card.className = "guided-question";

  const qTitle = document.createElement("h4");
  qTitle.textContent = question.title;
  card.appendChild(qTitle);

  const helper = document.createElement("p");
  helper.textContent = question.helper;
  card.appendChild(helper);

  const options = getFieldOptions(question.field, data);
  if (options.length > 0) {
    const optionWrap = document.createElement("div");
    optionWrap.className = "guided-options";

    options.slice(0, 8).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.addEventListener("click", () => applyTripContext(option.updates));
      optionWrap.appendChild(button);
    });

    card.appendChild(optionWrap);
  }

  if (question.manualType) {
    const manual = document.createElement("label");
    manual.className = "guided-manual";
    manual.innerHTML = `<span>${question.manualLabel}</span>`;

    const input = document.createElement("input");
    input.type = question.manualType;
    input.value = data[question.field] || "";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (input.value.trim()) applyTripContext({ [question.field]: input.value.trim() });
      }
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "שמור";
    button.addEventListener("click", () => {
      if (input.value.trim()) applyTripContext({ [question.field]: input.value.trim() });
    });

    manual.append(input, button);
    card.appendChild(manual);
  }

  wrapper.appendChild(card);
}

function getSuggestionGroups(missingFields) {
  const historyLines = getHistoryValues("lineNumber");
  const historyStations = getHistoryValues("stationName");
  const lineNumber = getCurrentLineNumber();
  const lineContext = getLineContext(lineNumber);
  const lineLabel = lineNumber ? ` לקו ${lineNumber}` : "";
  const groups = [];

  if (
    lineNumber &&
    lineContext.directions.length > 0 &&
    (missingFields.includes("originCity") || missingFields.includes("destination"))
  ) {
    groups.push({
      field: "routeDirection",
      title: `בחרו כיוון נסיעה לקו ${lineNumber}`,
      helper: "בחירת כיוון ממלאת יחד את עיר המוצא והיעד.",
      values: lineContext.directions,
    });
  }

  const suggestionMap = {
    lineNumber: {
      title: "מספר קו חסר",
      helper: "בחרו קו שהשתמשתם בו בעבר או הקלידו את המספר בשדה.",
      values: historyLines,
    },
    operator: {
      title: `חברה מפעילה חסרה${lineLabel}`,
      helper: lineNumber
        ? "ההצעות הראשונות מבוססות על הקו והיסטוריה מקומית."
        : "אפשר לבחור חברה נפוצה או להשאיר להשלמה ידנית.",
      values: uniqueValues([...lineContext.operators, ...knownOperators]).slice(0, 10),
    },
    originCity: {
      title: `עיר מוצא חסרה${lineLabel}`,
      helper: lineNumber
        ? "בחרו מוצא אפשרי לקו, לפי ידע מקומי והיסטוריה."
        : "בחרו עיר מוצא אם היא מתאימה למקרה.",
      values: uniqueValues([...lineContext.origins, ...knownCities]),
    },
    destination: {
      title: `יעד חסר${lineLabel}`,
      helper: lineNumber
        ? "בחרו יעד אפשרי לקו, לפי ידע מקומי והיסטוריה."
        : "בחרו יעד אם הוא מתאים למקרה.",
      values: uniqueValues([...lineContext.destinations, ...knownCities]),
    },
    stationName: {
      title: `מספר תחנה חסר${lineLabel}`,
      helper: lineNumber
        ? "התחנות מוצעות לפי הקו והכיוון שנבחר. הבחירה תמלא את מספר/שם התחנה בשדה."
        : "אפשר לבחור תחנה מהיסטוריה או להקליד שם/מספר תחנה.",
      values: lineContext.stationStops.length > 0
        ? lineContext.stationStops
        : uniqueValues([...lineContext.stations, ...historyStations]),
    },
    eventDate: {
      title: "תאריך האירוע חסר",
      helper: "בחרו תאריך מהיר או הזינו ידנית.",
      values: [
        { label: "היום", value: formatDateForInput(new Date()) },
        { label: "אתמול", value: getYesterdayValue() },
      ],
    },
  };

  return [
    ...groups,
    ...missingFields
    .filter((field) => suggestionMap[field])
    .map((field) => ({ field, ...suggestionMap[field] })),
  ];
}

function renderMissingSuggestions(missingFields) {
  const wrapper = getElement("missingSuggestions");
  const groups = getSuggestionGroups(missingFields).filter((group) => group.values.length > 0);

  wrapper.innerHTML = "";
  wrapper.classList.toggle("is-hidden", groups.length === 0);

  groups.forEach((group) => {
    const groupElement = document.createElement("div");
    groupElement.className = "suggestion-group";

    const title = document.createElement("p");
    title.className = "suggestion-group-title";
    title.textContent = group.title;
    groupElement.appendChild(title);

    const chips = document.createElement("div");
    chips.className = "suggestion-chips";

    group.values.slice(0, 8).forEach((suggestion) => {
      const value = typeof suggestion === "string" ? suggestion : suggestion.value;
      const label = typeof suggestion === "string" ? suggestion : suggestion.label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-chip";
      button.textContent = label;
      button.addEventListener("click", () => {
        if (group.field === "routeDirection") {
          getElement("originCity").value = suggestion.origin;
          getElement("destination").value = suggestion.destination;
          if (!getElement("operator").value && getLineContext(getCurrentLineNumber()).operators.length === 1) {
            getElement("operator").value = getLineContext(getCurrentLineNumber()).operators[0];
          }
          updateMissingHighlights();
          getElement("originCity").focus();
          return;
        }

        getElement(group.field).value = value;
        updateMissingHighlights();
        getElement(group.field).focus();
      });
      chips.appendChild(button);
    });

    groupElement.appendChild(chips);

    const helper = document.createElement("p");
    helper.className = "suggestion-helper";
    helper.textContent = group.helper;
    groupElement.appendChild(helper);

    wrapper.appendChild(groupElement);
  });
}

function parseDetails(text) {
  const normalized = normalizeText(text);
  const route = parseRoute(normalized);

  const data = {
    transportType: "אוטובוס",
    lineNumber: parseLineNumber(normalized),
    operator: parseOperator(normalized),
    originCity: route.originCity,
    destination: route.destination,
    stationName: parseStation(normalized),
    eventDate: parseDate(normalized),
    plannedTime: parseTime(normalized),
    issueType: parseIssueType(normalized),
    damage: parseDamage(normalized),
    description: normalized,
    contactName: "",
    contactPhone: "",
  };

  latestAnalysis = buildAnalysisSummary(data);
  return data;
}

function fillForm(data) {
  fields.forEach((field) => {
    getElement(field).value = data[field] || "";
  });
  syncTripContextFromForm();
  refreshSuggestionSources();
  renderAnalysisSummary(latestAnalysis);
  updateMissingHighlights();
}

function readForm() {
  return fields.reduce((data, field) => {
    data[field] = getElement(field).value.trim();
    return data;
  }, {});
}

function getMissingFields(data) {
  return requiredFields.filter((field) => !data[field]);
}

function updateMissingHighlights() {
  const data = readForm();
  syncTripContextFromForm();
  const missingFields = getMissingFields(data);
  refreshSuggestionSources();
  getElement("missingNotice").classList.toggle("is-hidden", missingFields.length === 0);
  renderGuidedAssistant(data, missingFields);
  getElement("missingSuggestions").classList.add("is-hidden");
  renderTripContextPanel();

  document.querySelectorAll("[data-required-field]").forEach((wrapper) => {
    wrapper.classList.toggle(
      "is-missing",
      missingFields.includes(wrapper.dataset.requiredField)
    );
  });

  return missingFields;
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function buildComplaintText(data) {
  const date = formatDisplayDate(data.eventDate) || "[תאריך האירוע]";
  const time = data.plannedTime || "[שעה מתוכננת]";
  const line = data.lineNumber || "[מספר קו]";
  const operator = data.operator || "[חברה מפעילה]";
  const station = data.stationName || "[מספר / שם תחנה]";
  const issue = data.issueType || "[סוג תקלה]";
  const description = (data.description || "").replace(/[.!?؟。]+$/u, "");
  const damage = data.damage || "[נזק שנגרם]";

  return `בתאריך ${date}, בשעה ${time}, בקו ${line} של חברת ${operator}, בתחנת ${station}, אירעה התקלה הבאה: ${issue}. ${description}. כתוצאה מכך נגרם: ${damage}. אבקש לבדוק את ביצוע הנסיעה, נתוני GPS וסיבת התקלה.`;
}

function buildAllText(data, complaintText) {
  const lines = fields
    .filter((field) => data[field])
    .map((field) => `${labels[field]}: ${data[field]}`);

  return `${lines.join("\n")}\n\nתיאור תלונה:\n${complaintText}`;
}

function renderSubmissionPack(data) {
  const tableBody = document.querySelector("#submissionTable tbody");
  const complaintText = buildComplaintText(data);

  tableBody.innerHTML = "";
  fields.forEach((field) => {
    const row = document.createElement("tr");
    const labelCell = document.createElement("td");
    const valueCell = document.createElement("td");
    labelCell.textContent = labels[field];
    valueCell.textContent = data[field] || "-";
    row.append(labelCell, valueCell);
    tableBody.appendChild(row);
  });

  getElement("complaintText").value = complaintText;
  currentCase = {
    ...data,
    complaintText,
    allText: buildAllText(data, complaintText),
    status: "מוכן להגשה",
    savedAt: new Date().toISOString(),
  };

  saveCase(currentCase);
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCase(caseData) {
  const history = getHistory();
  history.unshift(caseData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
}

function renderHistory() {
  const tableBody = document.querySelector("#historyTable tbody");
  const history = getHistory();
  tableBody.innerHTML = "";

  if (history.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "עדיין אין חבילות הגשה שנשמרו.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("tr");
    [
      formatDisplayDate(item.eventDate) || "-",
      item.lineNumber || "-",
      item.stationName || "-",
      item.issueType || "-",
      item.status || "מוכן להגשה",
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });

  refreshSuggestionSources();
}

async function copyText(text, successMessage) {
  if (!text) return;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  getElement("copyFeedback").textContent = successMessage;
  window.setTimeout(() => {
    getElement("copyFeedback").textContent = "";
  }, 2200);
}

getElement("analyzeButton").addEventListener("click", () => {
  const freeText = getElement("freeText").value;
  const parsed = parseDetails(freeText);
  fillForm(parsed);
  setStep(2);
});

getElement("backToTextButton").addEventListener("click", () => setStep(1));

getElement("swapRouteButton").addEventListener("click", () => {
  const origin = getElement("originCity").value;
  getElement("originCity").value = getElement("destination").value;
  getElement("destination").value = origin;
  updateMissingHighlights();
});

getElement("prepareButton").addEventListener("click", () => {
  const data = readForm();
  updateMissingHighlights();
  renderSubmissionPack(data);
  setStep(3);
});

getElement("editDetailsButton").addEventListener("click", () => setStep(2));

getElement("officialFormLink").href = OFFICIAL_COMPLAINT_FORM_URL;

getElement("clearHistoryButton").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.copy;
    const copyMap = {
      lineNumber: currentCase.lineNumber,
      stationName: currentCase.stationName,
      dateTime: `${formatDisplayDate(currentCase.eventDate)} ${currentCase.plannedTime}`.trim(),
      complaint: currentCase.complaintText,
      all: currentCase.allText,
    };

    copyText(copyMap[key], "הועתק ללוח");
  });
});

document.querySelectorAll("#detailsForm input, #detailsForm select, #detailsForm textarea").forEach((input) => {
  input.addEventListener("input", updateMissingHighlights);
});

refreshSuggestionSources();
renderHistory();
