window.__ModuleLoader__.load({ id: "dsh-interview", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  ToolResourceView: () => ToolResourceView,
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  resolveToolView: () => resolveToolView
});
module.exports = __toCommonJS(index_exports);
var import_react17 = __toESM(require("react"), 1);

// src/client/features/live-interview.js
var import_react12 = __toESM(require("react"), 1);

// src/domain/errors.js
var DomainError = class extends Error {
  constructor(code, message, details = void 0) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
};
function assertDomain(condition, code, message, details = void 0) {
  if (!condition) throw new DomainError(code, message, details);
}

// src/domain/practice-attachments.js
var DOCUMENT_LIMITS = Object.freeze({ fileBytes: 10 * 1024 * 1024, pages: 100, text: 6e4, references: 8, referenceText: 18e4 });
var DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md,.markdown";
var DOCUMENT_TYPES = Object.freeze(["pdf", "docx", "txt", "md", "markdown"]);

// src/client/shared/document-upload.js
function readDocumentUpload(file) {
  const type = file.name.split(".").at(-1).toLowerCase();
  if (!DOCUMENT_TYPES.includes(type)) return Promise.reject(new Error("\u652F\u6301 PDF\u3001DOCX\u3001TXT \u548C Markdown \u6587\u4EF6"));
  if (file.size > DOCUMENT_LIMITS.fileBytes) return Promise.reject(new Error("\u5355\u4EFD\u8D44\u6599\u4E0D\u80FD\u8D85\u8FC7 10 MB"));
  if (!file.size) return Promise.reject(new Error("\u6587\u4EF6\u4E3A\u7A7A\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9"));
    reader.onabort = () => reject(new Error("\u6587\u4EF6\u8BFB\u53D6\u5DF2\u53D6\u6D88"));
    reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}

// src/client/shared/api.js
var cache = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
var notificationListeners = /* @__PURE__ */ new Set();
var workspaceNavigationListeners = /* @__PURE__ */ new Set();
function cachedRequest(key, version, loader) {
  const current = cache.get(key);
  if (current && current.version >= version) return current.promise;
  if (current && !current.started) {
    current.version = version;
    current.loader = loader;
    return current.promise;
  }
  const entry = { version, loader, started: false, promise: null };
  entry.promise = Promise.resolve().then(() => {
    entry.started = true;
    return entry.loader();
  }).catch((error) => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  cache.set(key, entry);
  return entry.promise;
}
async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const value = await response.json().catch(() => null);
  if (!response.ok || value?.error) {
    const error = new Error(value?.error?.message || `HTTP ${response.status}`);
    error.code = value?.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return value;
}
function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== void 0 && value !== null && value !== "") params.set(key, value);
  return params.toString();
}
var interviewApi = {
  async extractDocument(file) {
    const payload = await readDocumentUpload(file);
    return jsonRequest("/interview/api/materials/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  },
  session(sessionId) {
    return jsonRequest(`/interview/api/session?${queryString({ session: sessionId })}`);
  },
  practices(filters = {}) {
    return jsonRequest(`/interview/api/practices?${queryString(filters)}`);
  },
  practice(practiceId) {
    return jsonRequest(`/interview/api/practice?${queryString({ id: practiceId })}`);
  },
  insights() {
    return jsonRequest("/interview/api/insights");
  },
  questionLearning(practiceId, questionId, sessionId = null) {
    return jsonRequest(`/interview/api/question-learning?${queryString({ practice: practiceId, question: questionId, session: sessionId })}`);
  },
  questionSolution(practiceId, questionId) {
    return jsonRequest(`/interview/api/question-solution?${queryString({ practice: practiceId, question: questionId })}`);
  },
  leetcodeCatalog() {
    return jsonRequest("/interview/api/leetcode");
  },
  async command(sessionId, command, payload = {}) {
    const value = await jsonRequest("/interview/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: sessionId, command, payload })
    });
    cache.clear();
    for (const listener of listeners) listener(value.revision);
    const message = value?.assistantResponse?.mode === "exact" ? value.assistantResponse.text : "";
    if (message) for (const listener of notificationListeners) listener(message);
    return value;
  },
  downloadUrl(token) {
    return `/interview/api/download?${queryString({ token })}`;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  subscribeNotifications(listener) {
    notificationListeners.add(listener);
    return () => notificationListeners.delete(listener);
  },
  navigateWorkspace(tab, context = null) {
    for (const listener of workspaceNavigationListeners) listener(tab, context);
  },
  subscribeWorkspaceNavigation(listener) {
    workspaceNavigationListeners.add(listener);
    return () => workspaceNavigationListeners.delete(listener);
  },
  cached(key, loader, version = 0) {
    return cachedRequest(key, Number.isFinite(Number(version)) ? Number(version) : 0, loader);
  },
  invalidate() {
    cache.clear();
    for (const listener of listeners) listener(Date.now());
  }
};

// src/client/shared/hooks.js
var import_react = __toESM(require("react"), 1);

// src/client/shared/single-flight.js
function createSingleFlight(handler) {
  let running = false;
  return async (...args) => {
    if (running) return null;
    running = true;
    try {
      return await handler(...args);
    } finally {
      running = false;
    }
  };
}

// src/client/shared/hooks.js
function useInterviewQuery(key, loader, dependencies = [], options = {}) {
  const cache2 = options.cache !== false;
  const version = options.version || 0;
  const [state, setState] = import_react.default.useState({ loading: true, data: null, error: "" });
  const requestSequenceRef = import_react.default.useRef(0);
  const load = import_react.default.useCallback((force = false) => {
    const requestSequence = ++requestSequenceRef.current;
    setState((current) => ({ ...current, loading: current.data === null, error: "" }));
    const request = force || !cache2 ? Promise.resolve().then(loader) : interviewApi.cached(key, loader, version);
    return request.then((data) => {
      if (requestSequence === requestSequenceRef.current) setState({ loading: false, data, error: "" });
      return data;
    }).catch((error) => {
      if (requestSequence === requestSequenceRef.current) {
        setState((current) => ({ ...current, loading: false, error: error.message || "\u52A0\u8F7D\u5931\u8D25" }));
      }
    });
  }, [key, cache2, version, ...dependencies]);
  import_react.default.useEffect(() => {
    load();
    const unsubscribe = interviewApi.subscribe(() => load());
    return () => {
      requestSequenceRef.current += 1;
      unsubscribe();
    };
  }, [load]);
  return { ...state, reload: () => load(true) };
}
function commandErrorMessage(error) {
  const message = error?.message || "\u64CD\u4F5C\u5931\u8D25";
  if (error?.code !== "INVALID_COMMAND") return message;
  return `${message}\uFF08\u63D2\u4EF6\u540E\u7AEF\u8FD8\u662F\u65E7\u7248\u672C\uFF0C\u91CD\u542F dsh web \u540E\u91CD\u8BD5\uFF09`;
}
function useCommand(sessionId) {
  const [state, setState] = import_react.default.useState({ busy: "", error: "" });
  const sessionIdRef = import_react.default.useRef(sessionId);
  const runnerRef = import_react.default.useRef(null);
  sessionIdRef.current = sessionId;
  if (!runnerRef.current) {
    runnerRef.current = createSingleFlight(async (command, payload = {}) => {
      setState({ busy: command, error: "" });
      try {
        return await interviewApi.command(sessionIdRef.current, command, payload);
      } catch (error) {
        setState({ busy: "", error: commandErrorMessage(error) });
        throw error;
      } finally {
        setState((current) => ({ ...current, busy: "" }));
      }
    });
  }
  const run = import_react.default.useCallback((command, payload = {}) => runnerRef.current(command, payload), []);
  return { ...state, run, clearError: () => setState((current) => ({ ...current, error: "" })) };
}

// src/client/shared/ui.js
var import_react2 = __toESM(require("react"), 1);
var primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);

// src/protocol/interaction-protocol.js
var INTERACTION_PROTOCOL = "dsh-interview/interaction-v2";

// src/client/shared/ui.js
var h = import_react2.default.createElement;
var MarkdownText2 = primitives.MarkdownText;
var MARKDOWN_LABELS = Object.freeze({
  code: Object.freeze({ copyLabel: "\u590D\u5236\u4EE3\u7801", copiedLabel: "\u5DF2\u590D\u5236" }),
  footnotes: "\u6CE8\u91CA"
});
function Markdown({ children }) {
  const text2 = String(children || "");
  return MarkdownText2 ? h(MarkdownText2, { text: text2, content: text2, labels: MARKDOWN_LABELS, className: "di-markdown" }) : h("div", { className: "di-preline di-markdown" }, text2);
}
var ICON_PATHS = {
  check: [h("path", { key: "p", d: "m5 12 4 4L19 6" })],
  eye: [h("path", { key: "p", d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }), h("circle", { key: "c", cx: 12, cy: 12, r: 2.5 })],
  copy: [h("rect", { key: "a", x: 9, y: 9, width: 10, height: 10, rx: 1.5 }), h("path", { key: "b", d: "M15 9V6.5A1.5 1.5 0 0 0 13.5 5h-7A1.5 1.5 0 0 0 5 6.5v7A1.5 1.5 0 0 0 6.5 15H9" })],
  swap: [h("path", { key: "a", d: "M7 7h11l-3-3m3 3-3 3" }), h("path", { key: "b", d: "M17 17H6l3 3m-3-3 3-3" })],
  trash: [h("path", { key: "a", d: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" })],
  download: [h("path", { key: "a", d: "M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" })],
  upload: [h("path", { key: "a", d: "M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4" })],
  play: [h("path", { key: "a", d: "M8 5.5v13l10-6.5L8 5.5Z" })],
  clock: [h("circle", { key: "a", cx: 12, cy: 12, r: 8 }), h("path", { key: "b", d: "M12 8v4l3 2" })],
  archive: [h("path", { key: "a", d: "M4 7h16v13H4V7Zm-1-3h18v3H3V4Zm6 7h6" })],
  code: [h("path", { key: "a", d: "m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12" })],
  grid: [h("rect", { key: "a", x: 4, y: 4, width: 6, height: 6, rx: 1 }), h("rect", { key: "b", x: 14, y: 4, width: 6, height: 6, rx: 1 }), h("rect", { key: "c", x: 4, y: 14, width: 6, height: 6, rx: 1 }), h("rect", { key: "d", x: 14, y: 14, width: 6, height: 6, rx: 1 })],
  close: [h("path", { key: "a", d: "m6 6 12 12M18 6 6 18" })],
  flame: [h("path", { key: "a", d: "M12 22c4 0 7-3 7-7 0-3-1.5-5.5-4.5-8 .2 2-1 3.5-2 4.5C12 8 10 5 7 3c.4 4-2 6-2 10 0 5 3 9 7 9Z" })],
  plus: [h("path", { key: "a", d: "M12 5v14M5 12h14" })],
  alert: [h("path", { key: "a", d: "M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0ZM12 9v4m0 3h.01" })],
  chevronDown: [h("path", { key: "a", d: "m7 10 5 5 5-5" })]
};
function Icon({ name: name2, size = 18 }) {
  return h("svg", {
    className: "di-icon",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, ...ICON_PATHS[name2] || []);
}
function StarRating({ score }) {
  const normalized = Math.max(0, Math.min(5, Number(score || 0) / 2));
  return h(
    "div",
    { className: "di-stars", "aria-label": `${Number(score || 0)} \u5206\uFF0C\u6EE1\u5206 10 \u5206` },
    Array.from({ length: 5 }, (_, index) => {
      const fill = Math.max(0, Math.min(1, normalized - index)) * 100;
      return h("span", { className: "di-star", key: index, style: { "--di-star-fill": `${fill}%` } }, "\u2605");
    })
  );
}
function resultText(block) {
  return (block?.content || []).filter((item) => item?.type === "text" && typeof item.text === "string").map((item) => item.text).join("\n");
}
function parseInteractionResult(block) {
  try {
    const value = JSON.parse(resultText(block));
    return value?.protocol === INTERACTION_PROTOCOL ? value : null;
  } catch {
    return null;
  }
}
function toolCallState(block) {
  if (!block || !("kind" in block)) return "running";
  return block.isError ? "error" : "success";
}
function toolErrorMessage(block) {
  const text2 = resultText(block).trim();
  return text2 || block?.error?.message || block?.error?.code || "\u5DE5\u5177\u6267\u884C\u5931\u8D25";
}
function toolErrorAudience(block) {
  const code = block?.error?.code || block?.error?.info?.code;
  return code === "INVALID_ARGS" ? "agent" : "user";
}
function ScoreRail({ score, compact = false }) {
  const normalized = Number.isFinite(Number(score)) ? Math.max(0, Math.min(10, Number(score))) : null;
  const tone = normalized === null ? "empty" : normalized >= 8 ? "good" : normalized >= 6 ? "mid" : "low";
  return h(
    "span",
    { className: `di-score-rail ${compact ? "is-compact" : ""}`, "aria-label": normalized === null ? "\u672A\u8BC4\u5206" : `${normalized} \u5206` },
    Array.from({ length: 10 }, (_, index) => h("i", { key: index, className: index < Math.round(normalized || 0) ? `is-on is-${tone}` : "" }))
  );
}
function Loading({ label = "\u6B63\u5728\u8BFB\u53D6\u9762\u8BD5\u6863\u6848\u2026" }) {
  return h("div", { className: "di-state" }, h("span", { className: "di-spinner" }), label);
}
function ErrorNotice({ children }) {
  return children ? h("div", { className: "di-notice is-error", role: "alert" }, children) : null;
}
function Empty({ title, detail }) {
  return h("div", { className: "di-empty" }, h("div", { className: "di-empty-title" }, title), detail ? h("span", null, detail) : null);
}
function Button({ children, tone = "quiet", busy = false, ...props }) {
  return h("button", { ...props, className: `di-button is-${tone}${props.className ? ` ${props.className}` : ""}`, disabled: props.disabled || busy }, busy ? "\u5904\u7406\u4E2D\u2026" : children);
}
var selectSequence = 0;
function Select({ value = "", options = [], placeholder = "\u8BF7\u9009\u62E9", onChange, disabled = false, className = "", ...props }) {
  const [open, setOpen] = import_react2.default.useState(false);
  const rootRef = import_react2.default.useRef(null);
  const menuIdRef = import_react2.default.useRef(null);
  if (!menuIdRef.current) menuIdRef.current = `di-select-menu-${++selectSequence}`;
  const menuId = menuIdRef.current;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  import_react2.default.useEffect(() => {
    if (!open) return void 0;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const choose = (option) => {
    if (option.disabled) return;
    onChange?.(option.value);
    setOpen(false);
  };
  const move = (offset) => {
    if (!options.length) return;
    let index = selectedIndex;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + offset + options.length) % options.length;
      if (!options[index].disabled) {
        choose(options[index]);
        return;
      }
    }
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const candidates = event.key === "Home" ? options : [...options].reverse();
      const option = candidates.find((item) => !item.disabled);
      if (option) choose(option);
    }
  };
  return h(
    "div",
    { ref: rootRef, className: `di-custom-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}` },
    h(
      "button",
      {
        ...props,
        type: "button",
        className: "di-custom-select-trigger",
        disabled,
        role: "combobox",
        "aria-expanded": open,
        "aria-controls": menuId,
        "aria-haspopup": "listbox",
        onClick: () => setOpen((current) => !current),
        onKeyDown
      },
      h("span", { className: selected ? "" : "is-placeholder" }, selected?.label || placeholder),
      h(Icon, { name: "chevronDown", size: 15 })
    ),
    open ? h("div", { id: menuId, className: "di-custom-select-menu", role: "listbox" }, options.map((option) => h("button", {
      type: "button",
      role: "option",
      key: option.value,
      className: `di-custom-select-option${option.value === value ? " is-selected" : ""}`,
      "aria-selected": option.value === value,
      disabled: option.disabled,
      onClick: () => choose(option)
    }, h("span", null, option.label), option.value === value ? h(Icon, { name: "check", size: 14 }) : null))) : null
  );
}

// src/domain/leetcode-top-100.js
var LEETCODE_TOP_100_SOURCE = Object.freeze({
  name: "LeetCode \u70ED\u9898 100",
  url: "https://leetcode.cn/studyplan/top-100-liked/"
});
var DIFFICULTY_LABELS = Object.freeze({ easy: "\u7B80\u5355", medium: "\u4E2D\u7B49", hard: "\u56F0\u96BE" });
function leetcodeDifficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] || String(difficulty || "");
}
var GROUPS = [
  { category: "\u54C8\u5E0C", problems: [
    ["1", "\u4E24\u6570\u4E4B\u548C", "two-sum", "easy"],
    ["49", "\u5B57\u6BCD\u5F02\u4F4D\u8BCD\u5206\u7EC4", "group-anagrams", "medium"],
    ["128", "\u6700\u957F\u8FDE\u7EED\u5E8F\u5217", "longest-consecutive-sequence", "medium"]
  ] },
  { category: "\u53CC\u6307\u9488", problems: [
    ["283", "\u79FB\u52A8\u96F6", "move-zeroes", "easy"],
    ["11", "\u76DB\u6700\u591A\u6C34\u7684\u5BB9\u5668", "container-with-most-water", "medium"],
    ["15", "\u4E09\u6570\u4E4B\u548C", "3sum", "medium"],
    ["42", "\u63A5\u96E8\u6C34", "trapping-rain-water", "hard"]
  ] },
  { category: "\u6ED1\u52A8\u7A97\u53E3", problems: [
    ["3", "\u65E0\u91CD\u590D\u5B57\u7B26\u7684\u6700\u957F\u5B50\u4E32", "longest-substring-without-repeating-characters", "medium"],
    ["438", "\u627E\u5230\u5B57\u7B26\u4E32\u4E2D\u6240\u6709\u5B57\u6BCD\u5F02\u4F4D\u8BCD", "find-all-anagrams-in-a-string", "medium"]
  ] },
  { category: "\u5B50\u4E32", problems: [
    ["560", "\u548C\u4E3A K \u7684\u5B50\u6570\u7EC4", "subarray-sum-equals-k", "medium"],
    ["239", "\u6ED1\u52A8\u7A97\u53E3\u6700\u5927\u503C", "sliding-window-maximum", "hard"],
    ["76", "\u6700\u5C0F\u8986\u76D6\u5B50\u4E32", "minimum-window-substring", "hard"]
  ] },
  { category: "\u666E\u901A\u6570\u7EC4", problems: [
    ["53", "\u6700\u5927\u5B50\u6570\u7EC4\u548C", "maximum-subarray", "medium"],
    ["56", "\u5408\u5E76\u533A\u95F4", "merge-intervals", "medium"],
    ["189", "\u8F6E\u8F6C\u6570\u7EC4", "rotate-array", "medium"],
    ["238", "\u9664\u4E86\u81EA\u8EAB\u4EE5\u5916\u6570\u7EC4\u7684\u4E58\u79EF", "product-of-array-except-self", "medium"],
    ["41", "\u7F3A\u5931\u7684\u7B2C\u4E00\u4E2A\u6B63\u6570", "first-missing-positive", "hard"]
  ] },
  { category: "\u77E9\u9635", problems: [
    ["73", "\u77E9\u9635\u7F6E\u96F6", "set-matrix-zeroes", "medium"],
    ["54", "\u87BA\u65CB\u77E9\u9635", "spiral-matrix", "medium"],
    ["48", "\u65CB\u8F6C\u56FE\u50CF", "rotate-image", "medium"],
    ["240", "\u641C\u7D22\u4E8C\u7EF4\u77E9\u9635 II", "search-a-2d-matrix-ii", "medium"]
  ] },
  { category: "\u94FE\u8868", problems: [
    ["160", "\u76F8\u4EA4\u94FE\u8868", "intersection-of-two-linked-lists", "easy"],
    ["206", "\u53CD\u8F6C\u94FE\u8868", "reverse-linked-list", "easy"],
    ["234", "\u56DE\u6587\u94FE\u8868", "palindrome-linked-list", "easy"],
    ["141", "\u73AF\u5F62\u94FE\u8868", "linked-list-cycle", "easy"],
    ["142", "\u73AF\u5F62\u94FE\u8868 II", "linked-list-cycle-ii", "medium"],
    ["21", "\u5408\u5E76\u4E24\u4E2A\u6709\u5E8F\u94FE\u8868", "merge-two-sorted-lists", "easy"],
    ["2", "\u4E24\u6570\u76F8\u52A0", "add-two-numbers", "medium"],
    ["19", "\u5220\u9664\u94FE\u8868\u7684\u5012\u6570\u7B2C N \u4E2A\u7ED3\u70B9", "remove-nth-node-from-end-of-list", "medium"],
    ["24", "\u4E24\u4E24\u4EA4\u6362\u94FE\u8868\u4E2D\u7684\u8282\u70B9", "swap-nodes-in-pairs", "medium"],
    ["25", "K \u4E2A\u4E00\u7EC4\u7FFB\u8F6C\u94FE\u8868", "reverse-nodes-in-k-group", "hard"],
    ["138", "\u968F\u673A\u94FE\u8868\u7684\u590D\u5236", "copy-list-with-random-pointer", "medium"],
    ["148", "\u6392\u5E8F\u94FE\u8868", "sort-list", "medium"],
    ["23", "\u5408\u5E76 K \u4E2A\u5347\u5E8F\u94FE\u8868", "merge-k-sorted-lists", "hard"],
    ["146", "LRU \u7F13\u5B58", "lru-cache", "medium"]
  ] },
  { category: "\u4E8C\u53C9\u6811", problems: [
    ["94", "\u4E8C\u53C9\u6811\u7684\u4E2D\u5E8F\u904D\u5386", "binary-tree-inorder-traversal", "easy"],
    ["104", "\u4E8C\u53C9\u6811\u7684\u6700\u5927\u6DF1\u5EA6", "maximum-depth-of-binary-tree", "easy"],
    ["226", "\u7FFB\u8F6C\u4E8C\u53C9\u6811", "invert-binary-tree", "easy"],
    ["101", "\u5BF9\u79F0\u4E8C\u53C9\u6811", "symmetric-tree", "easy"],
    ["543", "\u4E8C\u53C9\u6811\u7684\u76F4\u5F84", "diameter-of-binary-tree", "easy"],
    ["102", "\u4E8C\u53C9\u6811\u7684\u5C42\u5E8F\u904D\u5386", "binary-tree-level-order-traversal", "medium"],
    ["108", "\u5C06\u6709\u5E8F\u6570\u7EC4\u8F6C\u6362\u4E3A\u4E8C\u53C9\u641C\u7D22\u6811", "convert-sorted-array-to-binary-search-tree", "easy"],
    ["98", "\u9A8C\u8BC1\u4E8C\u53C9\u641C\u7D22\u6811", "validate-binary-search-tree", "medium"],
    ["230", "\u4E8C\u53C9\u641C\u7D22\u6811\u4E2D\u7B2C K \u5C0F\u7684\u5143\u7D20", "kth-smallest-element-in-a-bst", "medium"],
    ["199", "\u4E8C\u53C9\u6811\u7684\u53F3\u89C6\u56FE", "binary-tree-right-side-view", "medium"],
    ["114", "\u4E8C\u53C9\u6811\u5C55\u5F00\u4E3A\u94FE\u8868", "flatten-binary-tree-to-linked-list", "medium"],
    ["105", "\u4ECE\u524D\u5E8F\u4E0E\u4E2D\u5E8F\u904D\u5386\u5E8F\u5217\u6784\u9020\u4E8C\u53C9\u6811", "construct-binary-tree-from-preorder-and-inorder-traversal", "medium"],
    ["437", "\u8DEF\u5F84\u603B\u548C III", "path-sum-iii", "medium"],
    ["236", "\u4E8C\u53C9\u6811\u7684\u6700\u8FD1\u516C\u5171\u7956\u5148", "lowest-common-ancestor-of-a-binary-tree", "medium"],
    ["124", "\u4E8C\u53C9\u6811\u4E2D\u7684\u6700\u5927\u8DEF\u5F84\u548C", "binary-tree-maximum-path-sum", "hard"]
  ] },
  { category: "\u56FE\u8BBA", problems: [
    ["200", "\u5C9B\u5C7F\u6570\u91CF", "number-of-islands", "medium"],
    ["994", "\u8150\u70C2\u7684\u6A58\u5B50", "rotting-oranges", "medium"],
    ["207", "\u8BFE\u7A0B\u8868", "course-schedule", "medium"],
    ["208", "\u5B9E\u73B0 Trie (\u524D\u7F00\u6811)", "implement-trie-prefix-tree", "medium"]
  ] },
  { category: "\u56DE\u6EAF", problems: [
    ["46", "\u5168\u6392\u5217", "permutations", "medium"],
    ["78", "\u5B50\u96C6", "subsets", "medium"],
    ["17", "\u7535\u8BDD\u53F7\u7801\u7684\u5B57\u6BCD\u7EC4\u5408", "letter-combinations-of-a-phone-number", "medium"],
    ["39", "\u7EC4\u5408\u603B\u548C", "combination-sum", "medium"],
    ["22", "\u62EC\u53F7\u751F\u6210", "generate-parentheses", "medium"],
    ["79", "\u5355\u8BCD\u641C\u7D22", "word-search", "medium"],
    ["131", "\u5206\u5272\u56DE\u6587\u4E32", "palindrome-partitioning", "medium"],
    ["51", "N \u7687\u540E", "n-queens", "hard"]
  ] },
  { category: "\u4E8C\u5206\u67E5\u627E", problems: [
    ["35", "\u641C\u7D22\u63D2\u5165\u4F4D\u7F6E", "search-insert-position", "easy"],
    ["74", "\u641C\u7D22\u4E8C\u7EF4\u77E9\u9635", "search-a-2d-matrix", "medium"],
    ["34", "\u5728\u6392\u5E8F\u6570\u7EC4\u4E2D\u67E5\u627E\u5143\u7D20\u7684\u7B2C\u4E00\u4E2A\u548C\u6700\u540E\u4E00\u4E2A\u4F4D\u7F6E", "find-first-and-last-position-of-element-in-sorted-array", "medium"],
    ["33", "\u641C\u7D22\u65CB\u8F6C\u6392\u5E8F\u6570\u7EC4", "search-in-rotated-sorted-array", "medium"],
    ["153", "\u5BFB\u627E\u65CB\u8F6C\u6392\u5E8F\u6570\u7EC4\u4E2D\u7684\u6700\u5C0F\u503C", "find-minimum-in-rotated-sorted-array", "medium"],
    ["4", "\u5BFB\u627E\u4E24\u4E2A\u6B63\u5E8F\u6570\u7EC4\u7684\u4E2D\u4F4D\u6570", "median-of-two-sorted-arrays", "hard"]
  ] },
  { category: "\u6808", problems: [
    ["20", "\u6709\u6548\u7684\u62EC\u53F7", "valid-parentheses", "easy"],
    ["155", "\u6700\u5C0F\u6808", "min-stack", "medium"],
    ["394", "\u5B57\u7B26\u4E32\u89E3\u7801", "decode-string", "medium"],
    ["739", "\u6BCF\u65E5\u6E29\u5EA6", "daily-temperatures", "medium"],
    ["84", "\u67F1\u72B6\u56FE\u4E2D\u6700\u5927\u7684\u77E9\u5F62", "largest-rectangle-in-histogram", "hard"]
  ] },
  { category: "\u5806", problems: [
    ["215", "\u6570\u7EC4\u4E2D\u7684\u7B2CK\u4E2A\u6700\u5927\u5143\u7D20", "kth-largest-element-in-an-array", "medium"],
    ["347", "\u524D K \u4E2A\u9AD8\u9891\u5143\u7D20", "top-k-frequent-elements", "medium"],
    ["295", "\u6570\u636E\u6D41\u7684\u4E2D\u4F4D\u6570", "find-median-from-data-stream", "hard"]
  ] },
  { category: "\u8D2A\u5FC3\u7B97\u6CD5", problems: [
    ["121", "\u4E70\u5356\u80A1\u7968\u7684\u6700\u4F73\u65F6\u673A", "best-time-to-buy-and-sell-stock", "easy"],
    ["55", "\u8DF3\u8DC3\u6E38\u620F", "jump-game", "medium"],
    ["45", "\u8DF3\u8DC3\u6E38\u620F II", "jump-game-ii", "medium"],
    ["763", "\u5212\u5206\u5B57\u6BCD\u533A\u95F4", "partition-labels", "medium"]
  ] },
  { category: "\u52A8\u6001\u89C4\u5212", problems: [
    ["70", "\u722C\u697C\u68AF", "climbing-stairs", "easy"],
    ["118", "\u6768\u8F89\u4E09\u89D2", "pascals-triangle", "easy"],
    ["198", "\u6253\u5BB6\u52AB\u820D", "house-robber", "medium"],
    ["279", "\u5B8C\u5168\u5E73\u65B9\u6570", "perfect-squares", "medium"],
    ["322", "\u96F6\u94B1\u5151\u6362", "coin-change", "medium"],
    ["139", "\u5355\u8BCD\u62C6\u5206", "word-break", "medium"],
    ["300", "\u6700\u957F\u9012\u589E\u5B50\u5E8F\u5217", "longest-increasing-subsequence", "medium"],
    ["152", "\u4E58\u79EF\u6700\u5927\u5B50\u6570\u7EC4", "maximum-product-subarray", "medium"],
    ["416", "\u5206\u5272\u7B49\u548C\u5B50\u96C6", "partition-equal-subset-sum", "medium"],
    ["32", "\u6700\u957F\u6709\u6548\u62EC\u53F7", "longest-valid-parentheses", "hard"]
  ] },
  { category: "\u591A\u7EF4\u52A8\u6001\u89C4\u5212", problems: [
    ["62", "\u4E0D\u540C\u8DEF\u5F84", "unique-paths", "medium"],
    ["64", "\u6700\u5C0F\u8DEF\u5F84\u548C", "minimum-path-sum", "medium"],
    ["5", "\u6700\u957F\u56DE\u6587\u5B50\u4E32", "longest-palindromic-substring", "medium"],
    ["1143", "\u6700\u957F\u516C\u5171\u5B50\u5E8F\u5217", "longest-common-subsequence", "medium"],
    ["72", "\u7F16\u8F91\u8DDD\u79BB", "edit-distance", "medium"]
  ] },
  { category: "\u6280\u5DE7", problems: [
    ["136", "\u53EA\u51FA\u73B0\u4E00\u6B21\u7684\u6570\u5B57", "single-number", "easy"],
    ["169", "\u591A\u6570\u5143\u7D20", "majority-element", "easy"],
    ["75", "\u989C\u8272\u5206\u7C7B", "sort-colors", "medium"],
    ["31", "\u4E0B\u4E00\u4E2A\u6392\u5217", "next-permutation", "medium"],
    ["287", "\u5BFB\u627E\u91CD\u590D\u6570", "find-the-duplicate-number", "medium"]
  ] }
];
var LEETCODE_TOP_100_GROUPS = Object.freeze(GROUPS.map((group) => Object.freeze({
  category: group.category,
  problems: Object.freeze(group.problems.map(([id, title, slug, difficulty]) => Object.freeze({
    id,
    title,
    slug,
    difficulty,
    category: group.category,
    url: `https://leetcode.cn/problems/${slug}/`
  })))
})));
var LEETCODE_TOP_100 = Object.freeze(LEETCODE_TOP_100_GROUPS.flatMap((group) => group.problems));
var PROBLEM_BY_SLUG = new Map(LEETCODE_TOP_100.map((problem) => [problem.slug, problem]));

// src/client/features/leetcode.js
var import_react11 = __toESM(require("react"), 1);

// src/domain/leetcode-languages.js
var DEFINITIONS = [
  { id: "cpp", label: "C++", fence: "cpp", pattern: /```(?:cpp|c\+\+)\s*\r?\n[\s\S]+?```/i },
  { id: "java", label: "Java", fence: "java", pattern: /```java\s*\r?\n[\s\S]+?```/i },
  { id: "python", label: "Python", fence: "python", pattern: /```python\s*\r?\n[\s\S]+?```/i },
  { id: "c", label: "C", fence: "c", pattern: /```c\s*\r?\n[\s\S]+?```/i },
  { id: "go", label: "Go", fence: "go", pattern: /```(?:go|golang)\s*\r?\n[\s\S]+?```/i }
];
var LEETCODE_LANGUAGES = Object.freeze(DEFINITIONS.map((item) => Object.freeze(item)));
var LEETCODE_LANGUAGE_IDS = Object.freeze(LEETCODE_LANGUAGES.map((item) => item.id));
function leetcodeLanguageDefinition(id) {
  return LEETCODE_LANGUAGES.find((item) => item.id === id) || null;
}
function leetcodeLanguageLabel(id) {
  return leetcodeLanguageDefinition(id)?.label || String(id || "");
}

// src/domain/leetcode-guidance.js
var DEFINITIONS2 = [
  {
    id: "guided",
    label: "\u5F15\u5BFC\u6A21\u5F0F",
    detail: "\u5148\u8865\u524D\u7F6E\u77E5\u8BC6\uFF0C\u6309\u63D0\u793A\u9636\u68AF\u9010\u6B65\u63A8\u5BFC\uFF0C\u4E0D\u4E3B\u52A8\u7ED9\u7B54\u6848",
    hintTotal: 4
  },
  {
    id: "standard",
    label: "\u6807\u51C6\u6A21\u5F0F",
    detail: "\u76F4\u63A5\u52A8\u624B\u505A\u9898\uFF0C\u9700\u8981\u65F6\u81EA\u5DF1\u70B9\u63D0\u793A\u6216\u770B\u7B54\u6848",
    hintTotal: 3
  }
];
var LEETCODE_GUIDANCE_LEVELS = Object.freeze(DEFINITIONS2.map((item) => Object.freeze(item)));
var LEETCODE_GUIDANCE_IDS = Object.freeze(LEETCODE_GUIDANCE_LEVELS.map((item) => item.id));
var DEFAULT_LEETCODE_GUIDANCE = "standard";
function leetcodeGuidanceDefinition(id) {
  return LEETCODE_GUIDANCE_LEVELS.find((item) => item.id === id) || null;
}
function leetcodeGuidanceLabel(id) {
  return leetcodeGuidanceDefinition(id)?.label || leetcodeGuidanceDefinition(DEFAULT_LEETCODE_GUIDANCE).label;
}

// src/client/shared/card-activity.js
function isCardActive(session, artifact) {
  return Boolean(
    session?.selected && session.practice?.id === artifact?.practiceId && session.currentQuestionId === artifact?.questionId && session.revision === artifact?.sessionRevision
  );
}

// src/client/shared/card-transition.js
var import_react3 = __toESM(require("react"), 1);
function useCardLifecycle(disabled = false) {
  const consumedRef = import_react3.default.useRef(false);
  const [consumedBy, setConsumedBy] = import_react3.default.useState("");
  const locked = disabled || Boolean(consumedBy);
  const enter = import_react3.default.useCallback(async (action, task) => {
    if (disabled || consumedRef.current) return null;
    consumedRef.current = true;
    setConsumedBy(action);
    return task();
  }, [disabled]);
  return { locked, consumedBy, enter };
}
function useCardTransition(runCommand, artifact, disabled = false) {
  const lifecycle = useCardLifecycle(disabled);
  const run = import_react3.default.useCallback((command, payload = {}) => lifecycle.enter(command, () => runCommand(command, {
    ...payload,
    practiceId: artifact.practiceId,
    questionId: artifact.questionId,
    presentationId: artifact.presentationId,
    sessionRevision: artifact.sessionRevision
  })), [runCommand, lifecycle.enter, artifact.practiceId, artifact.questionId, artifact.presentationId, artifact.sessionRevision]);
  return { ...lifecycle, run };
}

// src/client/features/practice-config.js
var import_react6 = __toESM(require("react"), 1);

// src/client/features/practice-documents.js
var import_react4 = __toESM(require("react"), 1);
function documentInfoText(file) {
  return [file.name, file.pages ? `${file.pages} \u9875` : "", `${Math.round(file.size / 1024) || 1} KB`].filter(Boolean).join(" \xB7 ");
}
function ResumeDocumentField({ value, file, disabled, onChange, onFileChange, onPendingChange }) {
  const inputRef = import_react4.default.useRef(null);
  const busyRef = import_react4.default.useRef(false);
  const [progress, setProgress] = import_react4.default.useState("");
  const [error, setError] = import_react4.default.useState("");
  const [warnings, setWarnings] = import_react4.default.useState([]);
  const upload = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || disabled || busyRef.current) return;
    busyRef.current = true;
    setError("");
    setWarnings([]);
    setProgress(`\u6B63\u5728\u89E3\u6790 ${selected.name}\u2026`);
    onPendingChange(1);
    try {
      const { material } = await interviewApi.extractDocument(selected);
      onChange(material.text);
      const { text: _text, warnings: notices, id: _id, ...info } = material;
      onFileChange(info);
      setWarnings(notices || []);
    } catch (failure) {
      setError(failure.message || "\u7B80\u5386\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u6587\u4EF6");
    } finally {
      busyRef.current = false;
      setProgress("");
      onPendingChange(-1);
    }
  };
  return h(
    "section",
    { className: "di-field di-field-wide di-resume-document", "aria-label": "\u7B80\u5386\u5BFC\u5165" },
    h(
      "div",
      { className: "di-document-head" },
      h("span", null, "\u7B80\u5386"),
      h(Button, { disabled, busy: Boolean(progress), onClick: () => inputRef.current?.click() }, h(Icon, { name: "upload" }), file ? "\u66F4\u6362\u7B80\u5386\u6587\u4EF6" : "\u4E0A\u4F20\u7B80\u5386")
    ),
    h("input", { ref: inputRef, type: "file", accept: DOCUMENT_ACCEPT, hidden: true, disabled, "aria-label": "\u9009\u62E9\u7B80\u5386\u6587\u4EF6", onChange: upload }),
    h("div", { className: "di-meta" }, "\u652F\u6301 PDF\u3001DOCX\u3001TXT\u3001Markdown\uFF0C\u6BCF\u4EFD\u6700\u591A 10 MB\uFF1B\u5BFC\u5165\u540E\u53EF\u4FEE\u6539\u4E0B\u65B9\u6587\u5B57\u3002"),
    file ? h(
      "div",
      { className: "di-document-file", role: "status" },
      h("span", null, documentInfoText(file)),
      h(Button, { disabled, onClick: () => {
        onFileChange(null);
        setWarnings([]);
      } }, "\u79FB\u9664\u6587\u4EF6\u6807\u8BB0")
    ) : null,
    progress ? h("div", { className: "di-meta", role: "status", "aria-live": "polite" }, progress) : null,
    warnings.map((warning) => h("div", { className: "di-notice", key: warning }, warning)),
    h("textarea", { className: "di-input di-textarea", "aria-label": "\u7B80\u5386", maxLength: DOCUMENT_LIMITS.text, disabled, value, placeholder: "\u4E0A\u4F20\u7B80\u5386\u6587\u4EF6\uFF0C\u6216\u76F4\u63A5\u7C98\u8D34\u7B80\u5386\u6587\u5B57", onChange: (event) => onChange(event.target.value) }),
    h(ErrorNotice, null, error)
  );
}
function ReferenceDocumentsField({ materials, disabled, onChange, onPendingChange }) {
  const inputRef = import_react4.default.useRef(null);
  const busyRef = import_react4.default.useRef(false);
  const [progress, setProgress] = import_react4.default.useState("");
  const [error, setError] = import_react4.default.useState("");
  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || disabled || busyRef.current) return;
    if (materials.length + files.length > DOCUMENT_LIMITS.references) {
      setError("\u6700\u591A\u6DFB\u52A0 8 \u4EFD\u53C2\u8003\u8D44\u6599\uFF0C\u8BF7\u5148\u79FB\u9664\u4E0D\u9700\u8981\u7684\u8D44\u6599");
      return;
    }
    busyRef.current = true;
    setError("");
    onPendingChange(1);
    const next = [...materials];
    const notices = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`\u6B63\u5728\u89E3\u6790 ${file.name}\uFF08${index + 1}/${files.length}\uFF09\u2026`);
        try {
          const { material } = await interviewApi.extractDocument(file);
          if (next.some((item) => item.id === material.id)) {
            notices.push(`\u201C${file.name}\u201D\u5DF2\u6DFB\u52A0\uFF0C\u65E0\u9700\u91CD\u590D\u4E0A\u4F20\u3002`);
            continue;
          }
          if (next.reduce((sum, item) => sum + item.text.length, 0) + material.text.length > DOCUMENT_LIMITS.referenceText) {
            notices.push(`\u201C${file.name}\u201D\u672A\u6DFB\u52A0\uFF1A\u53C2\u8003\u8D44\u6599\u5408\u8BA1\u4E0D\u80FD\u8D85\u8FC7 180000 \u5B57\u7B26\u3002`);
            continue;
          }
          next.push(material);
          onChange([...next]);
          notices.push(...(material.warnings || []).map((message) => `${file.name}\uFF1A${message}`));
        } catch (failure) {
          notices.push(`${file.name}\uFF1A${failure.message || "\u89E3\u6790\u5931\u8D25"}`);
        }
      }
    } finally {
      busyRef.current = false;
      setProgress("");
      onPendingChange(-1);
      setError(notices.join("\n"));
    }
  };
  return h(
    "section",
    { className: "di-field-wide di-reference-documents", "aria-label": "\u53C2\u8003\u8D44\u6599" },
    h(
      "div",
      { className: "di-document-head" },
      h("span", null, `\u53C2\u8003\u8D44\u6599\uFF08\u53EF\u9009\uFF09${materials.length ? ` \xB7 ${materials.length}/${DOCUMENT_LIMITS.references}` : ""}`),
      h(Button, { disabled: disabled || materials.length >= DOCUMENT_LIMITS.references, busy: Boolean(progress), onClick: () => inputRef.current?.click() }, h(Icon, { name: "upload" }), "\u4E0A\u4F20\u53C2\u8003\u8D44\u6599")
    ),
    h("input", { ref: inputRef, type: "file", multiple: true, accept: DOCUMENT_ACCEPT, hidden: true, disabled, "aria-label": "\u9009\u62E9\u53C2\u8003\u8D44\u6599\u6587\u4EF6", onChange: upload }),
    h("div", { className: "di-meta" }, "\u53EF\u4E0A\u4F20\u5C97\u4F4D\u8BF4\u660E\u3001\u9879\u76EE\u4ECB\u7ECD\u6216\u9762\u8BD5\u7B14\u8BB0\u3002\u652F\u6301 PDF\u3001DOCX\u3001TXT\u3001Markdown\uFF0C\u6700\u591A 8 \u4EFD\uFF0C\u6BCF\u4EFD\u6700\u591A 10 MB\u3002"),
    h("div", { className: "di-meta" }, "\u7EC3\u4E60\u4FDD\u5B58\u63D0\u53D6\u7684\u6587\u5B57\u548C\u6587\u4EF6\u4FE1\u606F\uFF0CAI \u4F1A\u7ED3\u5408\u8FD9\u4E9B\u8D44\u6599\u63D0\u95EE\u3002"),
    progress ? h("div", { className: "di-meta", role: "status", "aria-live": "polite" }, progress) : null,
    materials.map((material) => h(
      "div",
      { className: "di-reference-file", key: material.id },
      h(
        "div",
        { className: "di-document-file" },
        h("span", null, documentInfoText(material)),
        h(Button, { disabled, "aria-label": `\u79FB\u9664\u53C2\u8003\u8D44\u6599\uFF1A${material.name}`, onClick: () => onChange(materials.filter((item) => item.id !== material.id)) }, "\u79FB\u9664")
      ),
      h(
        "details",
        null,
        h("summary", null, `\u67E5\u770B\u548C\u7F16\u8F91\u5185\u5BB9 \xB7 ${material.text.length} \u5B57\u7B26`),
        h("textarea", { className: "di-input di-textarea", value: material.text, disabled, maxLength: DOCUMENT_LIMITS.text, "aria-label": `\u53C2\u8003\u8D44\u6599\u5185\u5BB9\uFF1A${material.name}`, onChange: (event) => onChange(materials.map((item) => item.id === material.id ? { ...item, text: event.target.value } : item)) })
      ),
      !material.text.trim() ? h(ErrorNotice, null, "\u8D44\u6599\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u53EF\u8865\u5145\u6587\u5B57\u6216\u79FB\u9664\u8FD9\u4EFD\u8D44\u6599\u3002") : null
    )),
    h(ErrorNotice, null, error)
  );
}
function PracticeDocumentSources({ config }) {
  if (!config?.resumeFile && !config?.referenceMaterials?.length) return null;
  return h(
    "section",
    { className: "di-practice-sources" },
    config.resumeFile ? h("div", { className: "di-meta" }, `\u7B80\u5386\u6587\u4EF6\uFF1A${documentInfoText(config.resumeFile)}`) : null,
    config.referenceMaterials?.length ? h(
      "div",
      null,
      h("div", { className: "di-section-label" }, `\u53C2\u8003\u8D44\u6599 \xB7 ${config.referenceMaterials.length} \u4EFD`),
      config.referenceMaterials.map((material) => h(
        "details",
        { key: material.id, className: "di-reference-file" },
        h("summary", null, documentInfoText(material)),
        h("pre", { className: "di-document-text" }, material.text)
      ))
    ) : null
  );
}

// src/domain/leetcode-problems.js
var LEETCODE_DIFFICULTY_IDS = Object.freeze(["easy", "medium", "hard"]);
var LEETCODE_CATEGORIES = Object.freeze(LEETCODE_TOP_100_GROUPS.map((group) => group.category));
var DIFFICULTY_BY_LABEL = Object.freeze({
  \u7B80\u5355: "easy",
  \u4E2D\u7B49: "medium",
  \u56F0\u96BE: "hard",
  easy: "easy",
  medium: "medium",
  hard: "hard"
});
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function searchText(problem) {
  return `${problem.id} ${problem.title} ${problem.slug} ${problem.category}`.toLowerCase();
}
function leetcodeDifficultyFromLabel(value) {
  const key = text(value);
  return DIFFICULTY_BY_LABEL[key] || DIFFICULTY_BY_LABEL[key.toLowerCase()] || "";
}
function normalizeLeetcodeDifficulties(value) {
  if (value === void 0 || value === null) return [];
  assertDomain(Array.isArray(value), "INVALID_LEETCODE_DIFFICULTIES", "\u96BE\u5EA6\u6807\u7B7E\u5FC5\u987B\u662F\u5217\u8868\uFF0C\u53EF\u9009\u62E9 easy\u3001medium\u3001hard");
  const normalized = value.map(leetcodeDifficultyFromLabel);
  assertDomain(normalized.every(Boolean), "INVALID_LEETCODE_DIFFICULTIES", "\u96BE\u5EA6\u6807\u7B7E\u53EA\u80FD\u9009\u62E9 easy\u3001medium\u3001hard");
  return LEETCODE_DIFFICULTY_IDS.filter((id) => normalized.includes(id));
}
function leetcodeDifficultyTagsLabel(value) {
  return normalizeLeetcodeDifficulties(value).join(" + ") || "\u5168\u90E8\u96BE\u5EA6";
}
function matchesKeyword(problem, keyword) {
  const haystack = searchText(problem);
  return keyword.split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}
function relevance(problem, keyword) {
  if (problem.id === keyword) return 0;
  if (problem.slug === keyword) return 1;
  if (problem.title === keyword) return 2;
  if (problem.title.toLowerCase().includes(keyword)) return 3;
  return 4;
}
function listLeetcodeProblems({ keyword, category, difficulty, difficulties, limit = 20 } = {}) {
  const normalizedKeyword = text(keyword).toLowerCase();
  const normalizedCategory = text(category);
  const normalizedDifficulty = leetcodeDifficultyFromLabel(difficulty) || text(difficulty);
  const selectedDifficulties = difficulties === void 0 ? normalizedDifficulty ? [normalizedDifficulty] : [] : normalizeLeetcodeDifficulties(difficulties);
  const matched = LEETCODE_TOP_100.filter((problem) => !normalizedCategory || problem.category === normalizedCategory).filter((problem) => !selectedDifficulties.length || selectedDifficulties.includes(problem.difficulty)).filter((problem) => !normalizedKeyword || matchesKeyword(problem, normalizedKeyword));
  if (normalizedKeyword) matched.sort((left, right) => relevance(left, normalizedKeyword) - relevance(right, normalizedKeyword) || Number(left.id) - Number(right.id));
  const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), LEETCODE_TOP_100.length) : 20;
  return matched.slice(0, normalizedLimit).map((problem) => ({ ...problem }));
}

// src/client/shared/difficulty-tags.js
var import_react5 = __toESM(require("react"), 1);
function DifficultyBadge({ difficulty, custom = false }) {
  if (!LEETCODE_DIFFICULTY_IDS.includes(difficulty)) return custom ? h("span", { className: "di-lc-difficulty is-custom" }, "\u81EA\u5B9A\u4E49") : null;
  return h("span", { className: `di-lc-difficulty is-${difficulty}`, title: leetcodeDifficultyLabel(difficulty) }, difficulty);
}
function DifficultyTags({ value = [], onChange, counts = {}, disabled = false, label = "\u9009\u62E9\u8BAD\u7EC3\u96BE\u5EA6\u6807\u7B7E" }) {
  const selected = normalizeLeetcodeDifficulties(value);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((tag) => tag !== id) : LEETCODE_DIFFICULTY_IDS.filter((tag) => tag === id || selected.includes(tag)));
  return h(
    "div",
    { className: "di-difficulty-tags", role: "group", "aria-label": label },
    h("button", { type: "button", className: `di-difficulty-tag${selected.length ? "" : " is-selected"}`, disabled, "aria-pressed": !selected.length, onClick: () => onChange([]) }, "\u5168\u90E8\u96BE\u5EA6"),
    LEETCODE_DIFFICULTY_IDS.map((id) => h(
      "button",
      {
        type: "button",
        key: id,
        className: `di-difficulty-tag is-${id}${selected.includes(id) ? " is-selected" : ""}`,
        title: leetcodeDifficultyLabel(id),
        disabled,
        "aria-label": `${id}\uFF08${leetcodeDifficultyLabel(id)}\uFF09`,
        "aria-pressed": selected.includes(id),
        onClick: () => toggle(id)
      },
      h("span", null, id),
      Number.isFinite(counts[id]) ? h("span", { className: "di-difficulty-count" }, counts[id]) : null
    ))
  );
}

// src/client/features/practice-config.js
var PRACTICE_MODE_OPTIONS = Object.freeze([
  { value: "bagu", label: "\u80CC\u516B\u80A1" },
  { value: "mock", label: "\u6A21\u62DF\u9762\u8BD5" },
  { value: "resume_drill", label: "\u7B80\u5386\u62BC\u9898" },
  { value: "scenario", label: "\u573A\u666F\u9898" },
  { value: "leetcode", label: "\u5237\u529B\u6263" }
]);
function modeLabel(mode) {
  return PRACTICE_MODE_OPTIONS.find((option) => option.value === mode)?.label || "";
}
var CODING_OPTIONS = Object.freeze([
  { value: "true", label: "\u662F" },
  { value: "false", label: "\u5426" }
]);
var JD_OPTIONS = Object.freeze([
  { value: "true", label: "\u63D0\u4F9B JD" },
  { value: "false", label: "\u4E0D\u63D0\u4F9B JD" }
]);
var DIFFICULTY_OPTIONS = Object.freeze([
  { value: "junior", label: "\u521D\u7EA7" },
  { value: "intermediate", label: "\u4E2D\u7EA7" },
  { value: "senior", label: "\u9AD8\u7EA7" }
]);
function completedConfigText(payload) {
  if (!payload) return "";
  if (payload.mode === "mock") {
    const difficulty = DIFFICULTY_OPTIONS.find((option) => option.value === payload.config.difficulty)?.label || "";
    const jd = payload.config.jobDescriptionProvided ? "\u542B JD" : "\u672A\u63D0\u4F9B JD";
    return `${modeLabel(payload.mode)} \xB7 ${payload.config.targetRole} \xB7 ${difficulty}\u96BE\u5EA6 \xB7 ${jd}`;
  }
  if (payload.mode === "resume_drill") {
    const difficulty = DIFFICULTY_OPTIONS.find((option) => option.value === payload.config.difficulty)?.label || "";
    const jd = payload.config.jobDescriptionProvided ? "\u542B JD" : "\u672A\u63D0\u4F9B JD";
    return `${modeLabel(payload.mode)} \xB7 ${payload.config.targetRole} \xB7 ${difficulty}\u96BE\u5EA6 \xB7 ${jd}`;
  }
  if (payload.mode === "leetcode") {
    return `${modeLabel(payload.mode)} \xB7 ${leetcodeLanguageLabel(payload.config.language)} \xB7 ${leetcodeGuidanceLabel(payload.config.guidance)} \xB7 ${payload.config.category || "\u5168\u90E8\u4E13\u9898"} \xB7 ${leetcodeDifficultyTagsLabel(payload.config.difficulties)}`;
  }
  return `${modeLabel(payload.mode)} \xB7 ${payload.config.topic}`;
}
function PracticeConfigForm({
  initial = null,
  busy = false,
  disabled = false,
  onSubmit,
  onCancel = null,
  submitLabel = ""
}) {
  const [mode, setMode] = import_react6.default.useState(initial?.mode || "");
  const [step, setStep] = import_react6.default.useState(initial ? "config" : "mode");
  const [topic, setTopic] = import_react6.default.useState(initial?.config?.topic || "");
  const [resume, setResume] = import_react6.default.useState(initial?.config?.resume || "");
  const [resumeFile, setResumeFile] = import_react6.default.useState(initial?.config?.resumeFile || null);
  const [referenceMaterials, setReferenceMaterials] = import_react6.default.useState(initial?.config?.referenceMaterials || []);
  const [uploadsPending, setUploadsPending] = import_react6.default.useState(0);
  const [targetRole, setTargetRole] = import_react6.default.useState(initial?.config?.targetRole || "");
  const [jobDescriptionProvided, setJobDescriptionProvided] = import_react6.default.useState(typeof initial?.config?.jobDescriptionProvided === "boolean" ? String(initial.config.jobDescriptionProvided) : "");
  const [jobDescription, setJobDescription] = import_react6.default.useState(initial?.config?.jobDescription || "");
  const [focus, setFocus] = import_react6.default.useState(initial?.config?.focus || "");
  const [interviewerStyle, setInterviewerStyle] = import_react6.default.useState(initial?.config?.interviewerStyle || "");
  const [coding, setCoding] = import_react6.default.useState(typeof initial?.config?.coding === "boolean" ? String(initial.config.coding) : "");
  const [difficulty, setDifficulty] = import_react6.default.useState(initial?.config?.difficulty || "");
  const [language, setLanguage] = import_react6.default.useState(initial?.config?.language || "");
  const [guidance, setGuidance] = import_react6.default.useState(initial?.config?.guidance || "");
  const [leetcodeCategory, setLeetcodeCategory] = import_react6.default.useState(initial?.config?.category || "");
  const [leetcodeDifficulties, setLeetcodeDifficulties] = import_react6.default.useState(initial?.config?.difficulties || []);
  const topicMode = mode === "bagu" || mode === "scenario";
  const trainingCount = mode === "leetcode" ? listLeetcodeProblems({ category: leetcodeCategory, difficulties: leetcodeDifficulties, limit: 100 }).length : 0;
  const configurationValid = topicMode ? Boolean(topic.trim()) : mode === "leetcode" ? Boolean(language && guidance) : mode === "mock" && Boolean(
    resume.trim() && targetRole.trim() && jobDescriptionProvided !== "" && (jobDescriptionProvided !== "true" || jobDescription.trim()) && interviewerStyle.trim() && coding !== "" && difficulty
  ) || mode === "resume_drill" && Boolean(
    resume.trim() && targetRole.trim() && jobDescriptionProvided !== "" && (jobDescriptionProvided !== "true" || jobDescription.trim()) && focus.trim() && difficulty
  );
  const valid = configurationValid && (mode !== "leetcode" || trainingCount > 0) && referenceMaterials.every((item) => item.text.trim()) && referenceMaterials.reduce((sum, item) => sum + item.text.length, 0) <= DOCUMENT_LIMITS.referenceText;
  const formDisabled = disabled || busy || uploadsPending > 0;
  const pendingChanged = (delta) => setUploadsPending((count) => Math.max(0, count + delta));
  const submit = () => {
    if (step !== "config" || !valid || formDisabled) return;
    const payload = mode === "mock" ? {
      mode,
      config: {
        resume: resume.trim(),
        targetRole: targetRole.trim(),
        jobDescriptionProvided: jobDescriptionProvided === "true",
        jobDescription: jobDescriptionProvided === "true" ? jobDescription.trim() : "",
        interviewerStyle: interviewerStyle.trim(),
        coding: coding === "true",
        difficulty
      }
    } : mode === "resume_drill" ? {
      mode,
      config: {
        resume: resume.trim(),
        targetRole: targetRole.trim(),
        jobDescriptionProvided: jobDescriptionProvided === "true",
        jobDescription: jobDescriptionProvided === "true" ? jobDescription.trim() : "",
        focus: focus.trim(),
        difficulty
      }
    } : mode === "leetcode" ? { mode, config: {
      language,
      guidance,
      ...leetcodeCategory ? { category: leetcodeCategory } : {},
      ...leetcodeDifficulties.length ? { difficulties: leetcodeDifficulties } : {}
    } } : { mode, config: { topic: topic.trim() } };
    onSubmit({ ...payload, config: {
      ...payload.config,
      ...(mode === "mock" || mode === "resume_drill") && resumeFile ? { resumeFile } : {},
      ...referenceMaterials.length ? { referenceMaterials } : {}
    } });
  };
  const chooseMode = (value) => {
    if (disabled) return;
    setMode(value);
    setStep("config");
  };
  return h(
    "div",
    { className: "di-practice-form" },
    h(
      "ol",
      { className: "di-config-progress", "aria-label": "\u65B0\u5EFA\u7EC3\u4E60\u8FDB\u5EA6" },
      h("li", { className: step === "mode" ? "is-current" : "is-complete" }, h("span", null, "1"), "\u9009\u62E9\u6A21\u5F0F"),
      h("li", { className: step === "config" ? "is-current" : "" }, h("span", null, "2"), "\u586B\u5199\u914D\u7F6E")
    ),
    step === "mode" ? h(
      "section",
      { className: "di-config-stage di-field-wide", "aria-label": "\u9009\u62E9\u7EC3\u4E60\u6A21\u5F0F" },
      h("div", { className: "di-mode-options" }, PRACTICE_MODE_OPTIONS.map((option) => h("button", {
        type: "button",
        className: `di-mode-option is-${option.value}`,
        disabled,
        key: option.value,
        onClick: () => chooseMode(option.value)
      }, option.label)))
    ) : h(
      "section",
      { className: "di-config-stage di-config-fields di-field-wide", "aria-label": `${modeLabel(mode)}\u914D\u7F6E` },
      h("div", { className: "di-config-mode" }, h("span", null, "\u7EC3\u4E60\u6A21\u5F0F"), h("span", { className: `di-mode-badge is-${mode}` }, modeLabel(mode))),
      topicMode ? h(
        "label",
        { className: "di-field" },
        h("span", null, "\u4E3B\u9898"),
        h("input", { className: "di-input", disabled, value: topic, onChange: (event) => setTopic(event.target.value) })
      ) : null,
      mode === "leetcode" ? h(
        import_react6.default.Fragment,
        null,
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u7F16\u7A0B\u8BED\u8A00"),
          h(Select, { value: language, options: LEETCODE_LANGUAGES.map((item) => ({ value: item.id, label: item.label })), disabled, onChange: setLanguage, "aria-label": "\u9009\u62E9\u7F16\u7A0B\u8BED\u8A00" })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u5F15\u5BFC\u5F3A\u5EA6"),
          h(Select, {
            value: guidance,
            options: LEETCODE_GUIDANCE_LEVELS.map((item) => ({ value: item.id, label: item.label })),
            disabled,
            onChange: setGuidance,
            "aria-label": "\u9009\u62E9\u5F15\u5BFC\u5F3A\u5EA6"
          })
        ),
        guidance ? h("div", { className: "di-guidance-hint di-field-wide" }, LEETCODE_GUIDANCE_LEVELS.find((item) => item.id === guidance)?.detail || "") : null,
        h(
          "label",
          { className: "di-field di-field-wide" },
          h("span", null, "\u8BAD\u7EC3\u4E13\u9898"),
          h(Select, { value: leetcodeCategory, options: [{ value: "", label: "\u5168\u90E8\u4E13\u9898" }, ...LEETCODE_CATEGORIES.map((name2) => ({ value: name2, label: name2 }))], disabled: formDisabled, onChange: setLeetcodeCategory, "aria-label": "\u9009\u62E9\u8BAD\u7EC3\u4E13\u9898" })
        ),
        h(
          "div",
          { className: "di-field di-field-wide" },
          h("span", null, "\u8BAD\u7EC3\u96BE\u5EA6\u6807\u7B7E"),
          h(DifficultyTags, { value: leetcodeDifficulties, onChange: setLeetcodeDifficulties, disabled: formDisabled }),
          h("div", { className: "di-meta", role: "status" }, `\u53EF\u4EE5\u591A\u9009\u3002\u6240\u9009\u8303\u56F4\u6709 ${trainingCount} \u9053\u9898\uFF0C\u540E\u7EED\u6309\u4E13\u9898\u987A\u5E8F\u6216\u968F\u673A\u51FA\u9898\u90FD\u4F1A\u6CBF\u7528\u3002`),
          !trainingCount ? h("div", { className: "di-notice" }, "\u6240\u9009\u4E13\u9898\u548C\u96BE\u5EA6\u6CA1\u6709\u9898\u76EE\uFF0C\u8BF7\u8C03\u6574\u8BAD\u7EC3\u8303\u56F4\u3002") : null
        )
      ) : null,
      mode === "mock" ? h(
        import_react6.default.Fragment,
        null,
        h(ResumeDocumentField, { value: resume, file: resumeFile, disabled: formDisabled, onChange: setResume, onFileChange: setResumeFile, onPendingChange: pendingChanged }),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u76EE\u6807\u5C97\u4F4D"),
          h("input", { className: "di-input", disabled, value: targetRole, onChange: (event) => setTargetRole(event.target.value) })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u5C97\u4F4D\u63CF\u8FF0"),
          h(Select, { value: jobDescriptionProvided, options: JD_OPTIONS, disabled, onChange: setJobDescriptionProvided, "aria-label": "\u9009\u62E9\u662F\u5426\u63D0\u4F9B\u5C97\u4F4D\u63CF\u8FF0" })
        ),
        jobDescriptionProvided === "true" ? h(
          "label",
          { className: "di-field di-field-wide" },
          h("span", null, "JD"),
          h("textarea", { className: "di-input di-textarea", disabled, value: jobDescription, onChange: (event) => setJobDescription(event.target.value) })
        ) : null,
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u9762\u8BD5\u5B98\u98CE\u683C"),
          h("input", { className: "di-input", disabled, value: interviewerStyle, onChange: (event) => setInterviewerStyle(event.target.value) })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u662F\u5426\u624B\u6495\u4EE3\u7801"),
          h(Select, { value: coding, options: CODING_OPTIONS, disabled, onChange: setCoding, "aria-label": "\u9009\u62E9\u662F\u5426\u624B\u6495\u4EE3\u7801" })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u9762\u8BD5\u96BE\u5EA6"),
          h(Select, { value: difficulty, options: DIFFICULTY_OPTIONS, disabled, onChange: setDifficulty, "aria-label": "\u9009\u62E9\u9762\u8BD5\u96BE\u5EA6" })
        )
      ) : null,
      mode === "resume_drill" ? h(
        import_react6.default.Fragment,
        null,
        h(ResumeDocumentField, { value: resume, file: resumeFile, disabled: formDisabled, onChange: setResume, onFileChange: setResumeFile, onPendingChange: pendingChanged }),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u76EE\u6807\u5C97\u4F4D"),
          h("input", { className: "di-input", disabled, value: targetRole, onChange: (event) => setTargetRole(event.target.value) })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u5C97\u4F4D\u63CF\u8FF0"),
          h(Select, { value: jobDescriptionProvided, options: JD_OPTIONS, disabled, onChange: setJobDescriptionProvided, "aria-label": "\u9009\u62E9\u662F\u5426\u63D0\u4F9B\u5C97\u4F4D\u63CF\u8FF0" })
        ),
        jobDescriptionProvided === "true" ? h(
          "label",
          { className: "di-field di-field-wide" },
          h("span", null, "JD"),
          h("textarea", { className: "di-input di-textarea", disabled, value: jobDescription, onChange: (event) => setJobDescription(event.target.value) })
        ) : null,
        h(
          "label",
          { className: "di-field di-field-wide" },
          h("span", null, "\u62BC\u9898\u8303\u56F4"),
          h("input", { className: "di-input", disabled, value: focus, onChange: (event) => setFocus(event.target.value), placeholder: "\u4F8B\u5982\uFF1A\u9879\u76EE\u96BE\u70B9\u3001\u6280\u672F\u9009\u578B\u3001\u5E76\u53D1\u4E0E\u7A33\u5B9A\u6027" })
        ),
        h(
          "label",
          { className: "di-field" },
          h("span", null, "\u9762\u8BD5\u96BE\u5EA6"),
          h(Select, { value: difficulty, options: DIFFICULTY_OPTIONS, disabled, onChange: setDifficulty, "aria-label": "\u9009\u62E9\u9762\u8BD5\u96BE\u5EA6" })
        )
      ) : null,
      h(ReferenceDocumentsField, { materials: referenceMaterials, disabled: formDisabled, onChange: setReferenceMaterials, onPendingChange: pendingChanged })
    ),
    h(
      "div",
      { className: "di-actions di-field-wide" },
      onCancel ? h(Button, { disabled: formDisabled, onClick: onCancel }, "\u53D6\u6D88") : null,
      step === "config" ? h(Button, { disabled: formDisabled, onClick: () => setStep("mode") }, "\u4E0A\u4E00\u6B65") : null,
      step === "config" ? h(Button, { tone: "primary", disabled: formDisabled || !valid, busy, onClick: submit }, submitLabel || (initial ? "\u4FDD\u5B58\u914D\u7F6E" : "\u5F00\u59CB\u7EC3\u4E60")) : null
    )
  );
}
function PracticeSetupCard({ sessionId }) {
  const command = useCommand(sessionId);
  const lifecycle = useCardLifecycle(false);
  const [completedConfig, setCompletedConfig] = import_react6.default.useState(null);
  const start = (payload) => lifecycle.enter("session.start", () => {
    setCompletedConfig(payload);
    return command.run("session.start", payload);
  });
  if (lifecycle.consumedBy) {
    return h(
      "article",
      { className: "di-card di-setup-card is-complete", "aria-label": "\u7EC3\u4E60\u914D\u7F6E\u5DF2\u5C31\u7EEA" },
      h(
        "div",
        { className: "di-setup-complete", role: "status", "aria-live": "polite" },
        h("span", { className: "di-setup-complete-icon", "aria-hidden": "true" }, h(Icon, { name: "check", size: 18 })),
        h(
          "div",
          { className: "di-setup-complete-copy" },
          h("div", { className: "di-title" }, "\u7EC3\u4E60\u914D\u7F6E\u5DF2\u5C31\u7EEA"),
          h("div", { className: "di-meta" }, completedConfigText(completedConfig))
        )
      ),
      h(ErrorNotice, null, command.error)
    );
  }
  return h(
    "article",
    { className: "di-card di-setup-card", "aria-label": "\u65B0\u5EFA\u7EC3\u4E60\u914D\u7F6E" },
    h("header", { className: "di-card-head" }, h("div", { className: "di-title" }, "\u65B0\u5EFA\u7EC3\u4E60")),
    h(PracticeConfigForm, {
      busy: command.busy === "session.start",
      disabled: lifecycle.locked,
      onSubmit: start,
      submitLabel: "\u5F00\u59CB\u7EC3\u4E60"
    }),
    h(ErrorNotice, null, command.error)
  );
}

// src/application/leetcode-materials-fence.js
var DIFFICULTY_TONES = Object.freeze({ easy: "success", medium: "warn", hard: "danger" });
function materialsSourceLine(source) {
  if (!source || typeof source !== "object") return "";
  const anchor = typeof source.anchor === "string" ? source.anchor.replace(/^#+\s*/, "") : "";
  const parts = [];
  parts.push(source.official ? "\u793A\u4F8B\u4E0E\u6570\u636E\u8303\u56F4\u53D6\u81EA\u5B98\u65B9\u9898\u9762" : "\u9898\u76EE\u6750\u6599\u7531 AI \u64B0\u5199");
  if (source.file) parts.push(`\u53C2\u8003\u4E86\u4F60\u7684\u300A${source.file}${anchor ? ` \xB7 ${anchor}` : ""}\u300B\uFF0C\u5DF2\u6309\u9700\u91CD\u5199`);
  return parts.join("\uFF1B");
}

// src/client/features/code-answer.js
var import_react7 = __toESM(require("react"), 1);

// src/domain/code-answer.js
var CODE_LANGUAGES = Object.freeze([
  ...LEETCODE_LANGUAGES.map(({ id, label, fence }) => ({ id, label, fence })),
  { id: "javascript", label: "JavaScript", fence: "javascript" },
  { id: "typescript", label: "TypeScript", fence: "typescript" },
  { id: "rust", label: "Rust", fence: "rust" },
  { id: "csharp", label: "C#", fence: "csharp" },
  { id: "sql", label: "SQL", fence: "sql" }
].map(Object.freeze));
function parseCodeAnswer(answer) {
  if (typeof answer !== "string") return null;
  const match = /^代码作答（([^）]+)）\n\n(`{3,})([a-z]+)\n([\s\S]*?)\n\2(?:\n\n思路说明：\n([\s\S]*))?$/.exec(answer);
  if (!match) return null;
  const language = CODE_LANGUAGES.find((item) => item.fence === match[3] && item.label === match[1]);
  return language ? { language: language.id, code: match[4], notes: match[5] || "" } : null;
}

// src/client/shared/code-editing.js
function editCodeSelection(code, start, end, key, { shift = false, language = "python" } = {}) {
  if (key === "Enter") {
    const prefix = code.slice(code.lastIndexOf("\n", start - 1) + 1, start);
    const indentation = prefix.match(/^[ \t]*/)?.[0] || "";
    const extra = /[{[(]\s*$/.test(prefix) || language === "python" && /:\s*$/.test(prefix) ? "    " : "";
    const insert = `
${indentation}${extra}`;
    return { code: code.slice(0, start) + insert + code.slice(end), start: start + insert.length, end: start + insert.length };
  }
  if (key !== "Tab") return null;
  if (!shift && start === end) {
    return { code: code.slice(0, start) + "    " + code.slice(end), start: start + 4, end: start + 4 };
  }
  const lineStart = code.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start && code[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = code.indexOf("\n", lastSelected);
  const lineEnd = nextBreak === -1 ? code.length : nextBreak;
  const lines = code.slice(lineStart, lineEnd).split("\n");
  const removed = lines.map((line) => shift ? /^\t/.test(line) ? 1 : line.match(/^ {0,4}/)[0].length : 0);
  const changed = lines.map((line, index) => shift ? line.slice(removed[index]) : "    " + line).join("\n");
  const delta = changed.length - (lineEnd - lineStart);
  const firstDelta = shift ? -Math.min(removed[0], start - lineStart) : 4;
  return {
    code: code.slice(0, lineStart) + changed + code.slice(lineEnd),
    start: start + firstDelta,
    end: start === end ? start + firstDelta : end + delta
  };
}
function codeDraftKey(sessionId, practiceId, questionId) {
  return `dsh-interview:code-draft:v1:${JSON.stringify([sessionId, practiceId, questionId])}`;
}
function readCodeDraft(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || "null");
    return value && typeof value.code === "string" && typeof value.language === "string" ? { code: value.code, language: value.language, notes: typeof value.notes === "string" ? value.notes : "" } : null;
  } catch {
    return null;
  }
}
function saveCodeDraft(storage, key, draft) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

// src/client/features/code-answer.js
function draftStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function CodeAnswerEditor({ sessionId, question, artifact, language = "", disabled = false }) {
  const key = codeDraftKey(sessionId, artifact.practiceId, question.id);
  const latest = parseCodeAnswer(question.attempts?.at(-1)?.answer);
  const [draft, setDraft] = import_react7.default.useState(() => {
    const saved2 = !disabled && readCodeDraft(draftStorage(), key);
    return { code: "", notes: "", language: language || "python", ...latest || {}, ...saved2 || {}, ...language ? { language } : {} };
  });
  const draftRef = import_react7.default.useRef(draft);
  const codeRef = import_react7.default.useRef(null);
  const [saved, setSaved] = import_react7.default.useState(null);
  const [submission, setSubmission] = import_react7.default.useState(null);
  const command = useCommand(sessionId);
  const locked = disabled || Boolean(submission) || Boolean(command.busy);
  const update = (patch) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setSaved(saveCodeDraft(draftStorage(), key, next));
  };
  const submit = async () => {
    if (locked || !draftRef.current.code.trim()) return;
    try {
      const result = await command.run("question.code-review", { ...artifact, ...draftRef.current });
      setSubmission({ attemptId: result.references.attemptId, queued: result.analysisQueued });
    } catch {
    }
  };
  const retry = async () => {
    try {
      const result = await command.run("question.code-review.retry", { ...artifact, attemptId: submission.attemptId });
      setSubmission((current) => ({ ...current, queued: result.analysisQueued }));
    } catch {
    }
  };
  const keyDown = (event) => {
    event.stopPropagation();
    if (event.isComposing || event.nativeEvent?.isComposing || locked) return;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || !["Tab", "Enter"].includes(event.key)) return;
    const field = event.currentTarget;
    const edit = editCodeSelection(field.value, field.selectionStart, field.selectionEnd, event.key, {
      shift: event.shiftKey,
      language: draft.language
    });
    if (!edit) return;
    event.preventDefault();
    update({ code: edit.code });
    requestAnimationFrame(() => codeRef.current?.setSelectionRange(edit.start, edit.end));
  };
  return h(
    "section",
    { className: "di-code-answer", "aria-label": "\u4EE3\u7801\u4F5C\u7B54\u533A" },
    h(
      "header",
      { className: "di-code-toolbar" },
      h(
        "div",
        null,
        h("div", { className: "di-code-title" }, h(Icon, { name: "code" }), "\u4EE3\u7801\u4F5C\u7B54"),
        h("div", { className: "di-meta" }, "AI \u68C0\u67E5\u6B63\u786E\u6027\u3001\u8FB9\u754C\u6761\u4EF6\u548C\u590D\u6742\u5EA6\uFF0C\u4E0D\u6267\u884C\u4EE3\u7801")
      ),
      h(
        "label",
        { className: "di-code-language" },
        "\u8BED\u8A00",
        h(
          "select",
          { className: "di-input", value: draft.language, disabled: locked || Boolean(language), "aria-label": "\u4EE3\u7801\u8BED\u8A00", onChange: (event) => update({ language: event.target.value }) },
          CODE_LANGUAGES.map((item) => h("option", { key: item.id, value: item.id }, item.label))
        )
      )
    ),
    h(
      "div",
      { className: "di-code-field" },
      h(
        "pre",
        { className: "di-code-lines", "aria-hidden": "true", ref: (node) => {
          if (node) node.scrollTop = codeRef.current?.scrollTop || 0;
        } },
        Array.from({ length: draft.code.split("\n").length }, (_, index) => index + 1).join("\n")
      ),
      h("textarea", {
        ref: codeRef,
        className: "di-code-input",
        value: draft.code,
        readOnly: locked,
        "aria-label": "\u7F16\u5199\u4EE3\u7801",
        placeholder: "\u5728\u8FD9\u91CC\u5199\u4E0B\u4F60\u7684\u89E3\u6CD5\u2026",
        spellCheck: false,
        autoCorrect: "off",
        autoCapitalize: "off",
        wrap: "off",
        onChange: (event) => update({ code: event.target.value }),
        onKeyDown: keyDown,
        onScroll: (event) => {
          const gutter = event.currentTarget.previousElementSibling;
          if (gutter) gutter.scrollTop = event.currentTarget.scrollTop;
        }
      })
    ),
    h(
      "label",
      { className: "di-code-notes" },
      "\u601D\u8DEF\u8BF4\u660E\uFF08\u53EF\u9009\uFF09",
      h("textarea", { className: "di-input", value: draft.notes, readOnly: locked, rows: 2, "aria-label": "\u4EE3\u7801\u601D\u8DEF\u8BF4\u660E", placeholder: "\u63CF\u8FF0\u4F60\u7684\u601D\u8DEF\uFF0C\u6216\u544A\u8BC9 AI \u60F3\u91CD\u70B9\u68C0\u67E5\u54EA\u91CC", onChange: (event) => update({ notes: event.target.value }), onKeyDown: (event) => event.stopPropagation() })
    ),
    h(
      "div",
      { className: "di-code-footer" },
      h("div", { className: "di-meta", role: "status" }, submission ? submission.queued ? "\u4EE3\u7801\u5DF2\u4FDD\u5B58\uFF0CAI \u5206\u6790\u4F1A\u663E\u793A\u5728\u5BF9\u8BDD\u4E2D\u3002" : "\u4EE3\u7801\u5DF2\u4FDD\u5B58\uFF0CAI \u5206\u6790\u6682\u672A\u542F\u52A8\uFF0C\u8BF7\u91CD\u8BD5\u3002" : saved === false ? "\u6D4F\u89C8\u5668\u65E0\u6CD5\u4FDD\u5B58\u8349\u7A3F\uFF0C\u8BF7\u4FDD\u6301\u9875\u9762\u6253\u5F00\u3002" : disabled ? "\u5DF2\u4FDD\u5B58\u7684\u4EE3\u7801\u4F5C\u7B54" : "\u8349\u7A3F\u4FDD\u5B58\u5728\u672C\u6D4F\u89C8\u5668 \xB7 Tab \u7F29\u8FDB \xB7 Ctrl/\u2318+Enter \u5206\u6790"),
      submission && !submission.queued ? h(Button, { tone: "primary", busy: Boolean(command.busy), onClick: retry }, "\u91CD\u8BD5 AI \u5206\u6790") : h(
        Button,
        { tone: "primary", disabled: locked || !draft.code.trim(), busy: command.busy === "question.code-review", onClick: submit },
        h(Icon, { name: "code" }),
        submission ? "\u5DF2\u63D0\u4EA4\u5206\u6790" : "AI \u5206\u6790\u4EE3\u7801"
      )
    ),
    h(ErrorNotice, null, command.error)
  );
}

// src/client/features/question-learning.js
var import_react8 = __toESM(require("react"), 1);
function QuestionLearningPanel({ sessionId, practiceId, question }) {
  const query = useInterviewQuery(`learning:${sessionId}:${practiceId}:${question.id}`, () => interviewApi.questionLearning(practiceId, question.id, sessionId), [sessionId, practiceId, question.id], { cache: false });
  const command = useCommand(sessionId);
  const [bodyOpen, setBodyOpen] = import_react8.default.useState(true);
  const [guideOpen, setGuideOpen] = import_react8.default.useState(true);
  const [pollCount, setPollCount] = import_react8.default.useState(0);
  const autoRequested = import_react8.default.useRef("");
  const reloadRef = import_react8.default.useRef(query.reload);
  reloadRef.current = query.reload;
  const context = query.data?.resource?.data;
  const guide = context?.guidance;
  const generating = guide?.status === "generating";
  const generate = async (force = false, automatic = false) => {
    try {
      await command.run("question.guidance-generate", { practiceId, questionId: question.id, force, automatic });
      setPollCount(0);
      await reloadRef.current();
    } catch {
    }
  };
  import_react8.default.useEffect(() => {
    const key = `${sessionId}:${practiceId}:${question.id}`;
    if (!guideOpen || !guide?.canAutoGenerate || guide.ready || guide.status !== "missing" || autoRequested.current === key) return;
    autoRequested.current = key;
    void generate(false, true);
  }, [sessionId, practiceId, question.id, guideOpen, guide?.canAutoGenerate, guide?.ready, guide?.status]);
  import_react8.default.useEffect(() => {
    if (!guideOpen || !generating || pollCount >= 90) return void 0;
    const timer = setTimeout(() => {
      void reloadRef.current();
      setPollCount((value) => value + 1);
    }, 2e3);
    return () => clearTimeout(timer);
  }, [guideOpen, generating, guide?.requestId, pollCount]);
  const reveal = async () => {
    try {
      await command.run("question.learning-hint", { practiceId, questionId: question.id });
      await query.reload();
    } catch {
    }
  };
  if (query.loading && !context) return h("section", { className: "di-learning-panel" }, h(Loading, { label: "\u6B63\u5728\u8F7D\u5165\u5B8C\u6574\u9898\u76EE\u2026" }));
  if (!context) return h(ErrorNotice, null, query.error || "\u5B8C\u6574\u9898\u76EE\u6682\u672A\u8F7D\u5165\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
  const { problem, guidance } = context;
  return h(
    "section",
    { className: "di-learning-panel", "aria-label": "\u9898\u76EE\u4E0E\u5F15\u5BFC" },
    h(
      "div",
      { className: "di-learning-heading" },
      h("h4", null, "\u5B8C\u6574\u9898\u76EE"),
      h(Button, { "aria-expanded": bodyOpen, onClick: () => setBodyOpen((value) => !value) }, bodyOpen ? "\u6536\u8D77\u9898\u76EE" : "\u5C55\u5F00\u5B8C\u6574\u9898\u76EE")
    ),
    bodyOpen ? h(
      "div",
      { className: "di-problem-body" },
      problem.statement ? h("section", { "aria-label": "\u9898\u610F" }, h(Markdown, null, problem.statement)) : h("div", { className: "di-notice" }, "\u672C\u9898\u5C1A\u672A\u4FDD\u5B58\u5B8C\u6574\u9898\u9762\uFF0C\u53EF\u5148\u67E5\u770B\u5B98\u65B9\u9898\u76EE\u3002"),
      problem.examples.length ? h(
        "section",
        { "aria-label": "\u9898\u76EE\u793A\u4F8B" },
        h("h5", null, "\u793A\u4F8B"),
        problem.examples.map((example, index) => h(
          "div",
          { className: "di-lc-example", key: index },
          h("div", { className: "di-learning-example-title" }, `\u793A\u4F8B ${index + 1}`),
          h("div", null, h("span", null, "\u8F93\u5165"), h("code", null, example.input)),
          h("div", null, h("span", null, "\u8F93\u51FA"), h("code", null, example.output)),
          example.note ? h("div", null, h("span", null, "\u8BF4\u660E"), h("span", null, example.note)) : null
        ))
      ) : null,
      problem.constraints.length ? h(
        "section",
        { "aria-label": "\u9898\u76EE\u7EA6\u675F" },
        h("h5", null, "\u7EA6\u675F\u6761\u4EF6"),
        h("ul", { className: "di-learning-constraints" }, problem.constraints.map((constraint, index) => h("li", { key: index }, h("code", null, constraint))))
      ) : null,
      problem.advanced ? h("section", null, h("h5", null, "\u8FDB\u9636"), h(Markdown, null, problem.advanced)) : null,
      problem.source || problem.url ? h(
        "div",
        { className: "di-meta di-learning-source" },
        problem.source,
        problem.url ? h("a", { className: "di-link", href: problem.url, target: "_blank", rel: "noreferrer" }, "\u67E5\u770B\u5B98\u65B9\u9898\u76EE \u2197") : null
      ) : null
    ) : null,
    guidance.enabled || guidance.hintTotal ? h(
      "section",
      { className: "di-guided-panel", "aria-label": guidance.enabled ? "\u5F15\u5BFC\u6A21\u5F0F" : "\u89E3\u9898\u63D0\u793A" },
      h(
        "div",
        { className: "di-learning-heading" },
        h("h4", null, guidance.enabled ? "AI \u5F15\u5BFC\uFF1A\u4E00\u6B65\u4E00\u6B65\u63A8\u5BFC" : "AI \u89E3\u9898\u63D0\u793A"),
        h(Button, { "aria-expanded": guideOpen, onClick: () => setGuideOpen((value) => !value) }, guideOpen ? "\u6536\u8D77\u5F15\u5BFC" : "\u5C55\u5F00\u5F15\u5BFC")
      ),
      guideOpen ? h(
        import_react8.default.Fragment,
        null,
        h("div", { className: "di-meta", role: "status" }, guidance.ready ? guidance.reused ? "\u590D\u7528\u9898\u5E93\u4E2D\u7684 AI \u5F15\u5BFC \xB7 \u672C\u6B21\u672A\u8BF7\u6C42 AI \xB7 \u63D0\u793A\u9010\u7EA7\u89E3\u9501" : guidance.cached ? "AI \u5F15\u5BFC\u5DF2\u5B58\u5165\u9898\u5E93 \xB7 \u518D\u6B21\u7EC3\u4E60\u76F4\u63A5\u590D\u7528" : "AI \u9488\u5BF9\u672C\u9898\u751F\u6210 \xB7 \u63D0\u793A\u9010\u7EA7\u89E3\u9501" : "\u9996\u6B21\u751F\u6210\u540E\u5B58\u5165\u9898\u5E93\uFF0C\u91CD\u505A\u76F4\u63A5\u590D\u7528\uFF1B\u5B8C\u6574\u7B54\u6848\u4FDD\u6301\u906E\u853D"),
        generating ? h(Loading, { label: pollCount >= 90 ? "AI \u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u5BF9\u8BDD\u4E2D\u7684\u72B6\u6001\u540E\u91CD\u8BD5\u3002" : "AI \u6B63\u5728\u9605\u8BFB\u9898\u9762\u5E76\u63A8\u5BFC\u9010\u7EA7\u5F15\u5BFC\u2026" }) : null,
        guidance.enabled && guidance.ready ? h(
          "div",
          { className: "di-guided-intro" },
          h("div", { className: "di-guided-stages" }, ["\u8BFB\u61C2\u9898\u610F", "\u624B\u63A8\u793A\u4F8B", "\u63A8\u5BFC\u601D\u8DEF", "\u81EA\u5DF1\u7F16\u7801"].map((label, index) => h("span", { key: label, className: index === Math.min(guidance.hintLevel, 3) ? "is-current" : "" }, `${index + 1}. ${label}`))),
          h("p", null, guidance.introduction)
        ) : null,
        guidance.knowledge.length ? h(
          "div",
          { className: "di-guided-knowledge" },
          h("h5", null, "\u5148\u8865\u524D\u7F6E\u77E5\u8BC6"),
          guidance.knowledge.map((knowledge) => h("div", { key: knowledge.title }, h("div", { className: "di-lc-knowledge-title" }, knowledge.title), h(Markdown, null, knowledge.detail)))
        ) : null,
        guidance.revealedHints.map((hint, index) => h("div", { className: "di-guided-hint", key: index }, h("h5", null, `\u7B2C ${index + 1} \u7EA7\u5F15\u5BFC`), h(Markdown, null, hint))),
        !guidance.ready && !generating ? h("p", { className: "di-meta" }, guidance.canAutoGenerate ? "\u9898\u5E93\u4E2D\u8FD8\u6CA1\u6709\u5F53\u524D\u8BED\u8A00\u548C\u6A21\u5F0F\u7684\u5F15\u5BFC\uFF0C\u9996\u6B21\u751F\u6210\u540E\u4F1A\u4FDD\u5B58\u4F9B\u4EE5\u540E\u590D\u7528\u3002" : guidance.canGenerate ? "\u70B9\u51FB\u751F\u6210\uFF0C\u8BA9 AI \u6839\u636E\u8FD9\u9053\u9898\u7684\u793A\u4F8B\u3001\u7EA6\u675F\u548C\u7EC3\u4E60\u8BED\u8A00\u7F16\u5199\u5F15\u5BFC\u3002" : "\u8FD9\u9053\u9898\u5C1A\u672A\u751F\u6210 AI \u5F15\u5BFC\uFF0C\u8BF7\u5148\u91CD\u65B0\u6253\u5F00\u7EC3\u4E60\u3002") : null,
        h(
          "div",
          { className: "di-guided-actions" },
          guidance.ready ? h(
            import_react8.default.Fragment,
            null,
            h("span", { className: "di-meta", role: "status" }, `\u5DF2\u89E3\u9501 ${guidance.hintLevel}/${guidance.hintTotal}\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u5C55\u793A\u540E\u7EED\u63D0\u793A\u6216\u7B54\u6848`),
            h(
              Button,
              { tone: "primary", disabled: !sessionId || !guidance.canReveal || generating || Boolean(command.busy), busy: command.busy === "question.learning-hint", onClick: reveal },
              guidance.hintLevel >= guidance.hintTotal ? "\u5F15\u5BFC\u5DF2\u5168\u90E8\u89E3\u9501" : guidance.enabled ? "\u89E3\u9501\u4E0B\u4E00\u6B65\u5F15\u5BFC" : "\u7ED9\u6211\u4E00\u4E2A\u63D0\u793A"
            )
          ) : null,
          guidance.canGenerate ? h(Button, {
            tone: guidance.ready ? "default" : "primary",
            disabled: !sessionId || generating || Boolean(command.busy),
            busy: command.busy === "question.guidance-generate",
            title: guidance.ready ? "\u4F1A\u91CD\u65B0\u8BF7\u6C42 AI \u5E76\u66F4\u65B0\u9898\u5E93\u7F13\u5B58\uFF0C\u4ECE\u7B2C 1 \u7EA7\u91CD\u65B0\u89E3\u9501\uFF1B\u4EE3\u7801\u8349\u7A3F\u4FDD\u7559" : void 0,
            onClick: () => generate(guidance.ready)
          }, guidance.ready ? "\u91CD\u65B0\u751F\u6210 AI \u5F15\u5BFC" : "\u751F\u6210 AI \u5F15\u5BFC") : null
        ),
        h(ErrorNotice, null, command.error || guidance.error)
      ) : null
    ) : null,
    h(ErrorNotice, null, query.error)
  );
}

// src/client/features/question-solution.js
var import_react10 = __toESM(require("react"), 1);

// src/client/shared/solution-disclosure.js
var import_react9 = __toESM(require("react"), 1);
function SolutionDisclosure({ children, onToggle }) {
  const [open, setOpen] = import_react9.default.useState(false);
  return h(
    "section",
    { className: `di-solution-disclosure${open ? " is-open" : ""}`, "aria-label": "\u6B63\u786E\u7B54\u6848" },
    h(
      "div",
      { className: "di-solution-toggle" },
      h("span", { className: "di-meta" }, open ? "\u6B63\u786E\u7B54\u6848" : "\u6B63\u786E\u7B54\u6848\u5DF2\u906E\u853D\uFF0C\u5148\u72EC\u7ACB\u601D\u8003"),
      h(
        Button,
        { onClick: () => {
          const next = !open;
          setOpen(next);
          onToggle?.(next);
        }, "aria-expanded": open },
        h(Icon, { name: "eye" }),
        open ? "\u6536\u8D77\u6B63\u786E\u7B54\u6848" : "\u5C55\u5F00\u6B63\u786E\u7B54\u6848"
      )
    ),
    open ? h("div", { className: "di-solution-body" }, children) : null
  );
}

// src/client/features/question-solution.js
function QuestionSolutionPanel({ sessionId, practiceId, question, canGenerate = true }) {
  const [opened, setOpened] = import_react10.default.useState(false);
  const [pending, setPending] = import_react10.default.useState(false);
  const [pollCount, setPollCount] = import_react10.default.useState(0);
  const [notice, setNotice] = import_react10.default.useState("");
  const command = useCommand(sessionId);
  const query = useInterviewQuery(`solution:${practiceId}:${question.id}:${opened}`, () => opened ? interviewApi.questionSolution(practiceId, question.id) : Promise.resolve(null), [practiceId, question.id, opened], { cache: false });
  const solution = query.data?.resource?.data || (question.explanation ? { available: true, allowed: true, source: "AI \u8BB2\u89E3", ...question.explanation } : null);
  const generating = solution?.status === "generating" || pending;
  const reloadRef = import_react10.default.useRef(query.reload);
  reloadRef.current = query.reload;
  import_react10.default.useEffect(() => {
    if (pending && solution?.status !== "generating" && (solution?.available || solution?.status === "failed")) {
      setPending(false);
      setNotice("");
    }
  }, [pending, solution?.available, solution?.status]);
  import_react10.default.useEffect(() => {
    if (!opened || !generating || pollCount >= 90) return void 0;
    const timer = setTimeout(() => {
      void reloadRef.current();
      setPollCount((value) => value + 1);
    }, 2e3);
    return () => clearTimeout(timer);
  }, [opened, generating, pollCount]);
  const generate = async (force = false) => {
    try {
      const result = await command.run("question.solution-generate", { practiceId, questionId: question.id, force });
      if (result.analysisQueued) {
        setPending(true);
        setPollCount(0);
        setNotice("");
      } else if (result.cacheHit) {
        setPending(false);
        setNotice("\u76F4\u63A5\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u7B54\u6848\uFF0C\u672C\u6B21\u672A\u8BF7\u6C42 AI\u3002");
      } else setNotice(result.resource?.data?.error || "\u7B54\u6848\u751F\u6210\u8BF7\u6C42\u6682\u672A\u542F\u52A8\uFF0C\u8BF7\u786E\u8BA4\u5F53\u524D\u5BF9\u8BDD\u53EF\u7528\u540E\u91CD\u8BD5\u3002");
      await reloadRef.current();
    } catch {
    }
  };
  return h(
    SolutionDisclosure,
    { onToggle: setOpened },
    !solution && query.loading ? h(Loading, { label: "\u6B63\u5728\u8BFB\u53D6\u53C2\u8003\u7B54\u6848\u2026" }) : null,
    solution?.available ? h(
      import_react10.default.Fragment,
      null,
      h("div", { className: "di-meta di-solution-source" }, solution.source),
      h(Markdown, null, solution.detail),
      solution.memorizationPoints ? h("section", { className: "di-attempt" }, h("div", { className: "di-section-label" }, question.leetcode ? "\u89E3\u9898\u8981\u70B9" : "\u53C2\u8003\u8981\u70B9"), h(Markdown, null, solution.memorizationPoints)) : null,
      solution.reused ? h("p", { className: "di-meta", role: "status" }, "\u8FD9\u4EFD\u8BB2\u89E3\u76F4\u63A5\u4ECE\u9898\u5E93\u8BFB\u53D6\uFF0C\u672A\u8BF7\u6C42 AI\u3002") : null,
      solution.canGenerate && canGenerate ? h(
        Button,
        {
          disabled: !sessionId || generating || Boolean(command.busy),
          title: "\u91CD\u65B0\u8BF7\u6C42 AI\uFF0C\u751F\u6210\u9002\u7528\u4E8E\u4EE5\u540E\u7EC3\u4E60\u7684\u901A\u7528\u8BB2\u89E3\u5E76\u66F4\u65B0\u9898\u5E93\u7F13\u5B58",
          onClick: () => generate(true)
        },
        solution.source.startsWith("\u672C\u5730\u9898\u89E3\u5E93") ? "\u751F\u6210 AI \u8BE6\u89E3\u5E76\u4FDD\u5B58" : "\u91CD\u65B0\u751F\u6210 AI \u8BB2\u89E3"
      ) : null
    ) : solution ? h(
      "div",
      { className: "di-solution-missing" },
      h("p", null, solution.reason || "\u8FD9\u9053\u9898\u8FD8\u6CA1\u6709\u4FDD\u5B58\u53C2\u8003\u7B54\u6848\u3002"),
      !generating && solution.allowed !== false ? h(Button, { tone: "primary", disabled: !sessionId || !canGenerate, busy: Boolean(command.busy), onClick: () => generate(false) }, "\u751F\u6210\u53C2\u8003\u7B54\u6848\u5E76\u4FDD\u5B58") : null,
      !canGenerate && solution.allowed !== false ? h("div", { className: "di-meta" }, "\u8BF7\u5148\u91CD\u65B0\u6253\u5F00\u7EC3\u4E60\uFF0C\u518D\u751F\u6210\u7B54\u6848\u3002") : null
    ) : null,
    generating ? h("p", { className: "di-meta", role: "status" }, pollCount >= 90 ? "\u7B54\u6848\u4ECD\u5728\u751F\u6210\uFF0C\u8BF7\u68C0\u67E5\u5BF9\u8BDD\u4E2D\u7684\u72B6\u6001\u540E\u91CD\u8BD5\u3002" : "AI \u6B63\u5728\u751F\u6210\u901A\u7528\u8BB2\u89E3\uFF0C\u5B8C\u6210\u540E\u4F1A\u4FDD\u5B58\u5230\u9898\u5E93\u4F9B\u4EE5\u540E\u590D\u7528\u3002") : null,
    h(ErrorNotice, null, notice || solution?.error || command.error || query.error)
  );
}

// src/client/features/leetcode.js
function catalogProblems(catalog) {
  return catalog?.groups?.flatMap((group) => group.problems) || [];
}
function catalogProblem(catalog, slug) {
  return catalogProblems(catalog).find((problem) => problem.slug === slug) || null;
}
function matchesKeyword2(problem, keyword) {
  if (!keyword) return true;
  const haystack = `${problem.id} ${problem.title} ${problem.slug} ${problem.category}`.toLowerCase();
  return keyword.toLowerCase().split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}
function filterProblems(problems, { keyword, difficulties = [], category }) {
  return problems.filter((problem) => !difficulties.length || difficulties.includes(problem.difficulty)).filter((problem) => !category || problem.category === category).filter((problem) => matchesKeyword2(problem, keyword));
}
function GuidanceBadge({ guidance }) {
  const definition = LEETCODE_GUIDANCE_LEVELS.find((item) => item.id === guidance);
  if (!definition) return null;
  return h("span", { className: `di-guidance-badge is-${definition.id}`, title: definition.detail }, definition.label);
}
function CompletionButton({ problem, pending, onToggle }) {
  return h("button", {
    type: "button",
    className: `di-lc-check${problem.completed ? " is-complete" : ""}`,
    disabled: pending,
    "aria-pressed": problem.completed,
    "aria-label": problem.completed ? `\u5C06${problem.title}\u6807\u8BB0\u4E3A\u672A\u5B8C\u6210` : `\u5C06${problem.title}\u6807\u8BB0\u4E3A\u5B8C\u6210`,
    onClick: () => onToggle(problem)
  }, problem.completed ? "\u2713" : "");
}
function LeetcodeStartButton({ problem, busy, disabled, onStart }) {
  return h("button", {
    type: "button",
    className: "di-lc-start",
    disabled: disabled || busy,
    "aria-label": `\u5F00\u59CB\u505A${problem.title}`,
    onClick: () => onStart(problem)
  }, busy ? "\u51C6\u5907\u4E2D\u2026" : "\u505A\u8FD9\u9898");
}
function CustomProblemForm({ disabled, busy, onStart }) {
  const [number, setNumber] = import_react11.default.useState("");
  const [title, setTitle] = import_react11.default.useState("");
  const [slug, setSlug] = import_react11.default.useState("");
  const valid = Boolean(title.trim() || slug.trim());
  const submit = () => {
    if (!valid || disabled) return;
    onStart({ number: number.trim(), title: title.trim(), slug: slug.trim(), custom: true });
  };
  return h(
    "section",
    { className: "di-lc-custom" },
    h(
      "div",
      { className: "di-lc-custom-head" },
      h(
        "div",
        null,
        h("div", { className: "di-lc-custom-title" }, "\u70ED\u9898 100 \u91CC\u6CA1\u6709\uFF1F\u76F4\u63A5\u70B9\u540D\u4E00\u9053"),
        h("div", { className: "di-meta" }, "\u586B\u5199\u9898\u53F7\u3001\u9898\u540D\uFF0C\u6216\u8005\u529B\u6263\u7684\u82F1\u6587 slug\uFF08\u4F8B\u5982 sliding-window-maximum\uFF09\u3002")
      )
    ),
    h(
      "div",
      { className: "di-lc-custom-fields" },
      h("input", { className: "di-input", value: number, disabled, placeholder: "\u9898\u53F7\uFF0C\u4F8B\u5982 300", onChange: (event) => setNumber(event.target.value), "aria-label": "\u529B\u6263\u9898\u53F7" }),
      h("input", { className: "di-input", value: title, disabled, placeholder: "\u9898\u540D\uFF0C\u4F8B\u5982 \u6700\u957F\u9012\u589E\u5B50\u5E8F\u5217", onChange: (event) => setTitle(event.target.value), "aria-label": "\u529B\u6263\u9898\u540D" }),
      h("input", { className: "di-input", value: slug, disabled, placeholder: "slug\uFF08\u53EF\u9009\uFF09", onChange: (event) => setSlug(event.target.value), "aria-label": "\u529B\u6263\u9898\u76EE slug" }),
      h(Button, { tone: "primary", disabled: disabled || !valid, busy, onClick: submit }, "\u5F00\u59CB\u8FD9\u9053\u9898")
    )
  );
}
function CatalogRow({ problem, pendingSlug, disabled = false, onToggle, onStart }) {
  return h(
    "div",
    { className: `di-lc-row is-selectable${problem.completed ? " is-complete" : ""}` },
    h(CompletionButton, { problem, pending: pendingSlug === problem.slug, onToggle }),
    h(
      "a",
      { className: "di-lc-problem-link", href: problem.url, target: "_blank", rel: "noreferrer" },
      h("span", { className: "di-lc-problem-id" }, problem.id),
      h("span", null, problem.title),
      h("span", { className: "di-lc-open", "aria-hidden": "true" }, "\u2197")
    ),
    h(DifficultyBadge, { difficulty: problem.difficulty }),
    h(LeetcodeStartButton, {
      problem,
      busy: pendingSlug === problem.slug,
      disabled: disabled || Boolean(pendingSlug) && pendingSlug !== problem.slug,
      onStart
    })
  );
}
function CatalogGroup({ group, pendingSlug, disabled = false, onToggle, onStart }) {
  const completed = group.problems.filter((problem) => problem.completed).length;
  return h(
    "section",
    { className: "di-lc-group" },
    h(
      "div",
      { className: "di-lc-group-head" },
      h("h3", null, group.category),
      h("span", null, `${completed}/${group.problems.length}`)
    ),
    h("div", { className: "di-lc-problems" }, group.problems.map((problem) => h(CatalogRow, {
      key: problem.slug,
      problem,
      pendingSlug,
      disabled,
      onToggle,
      onStart
    })))
  );
}
function LeetcodeCatalog({ sessionId }) {
  const query = useInterviewQuery("leetcode-catalog", () => interviewApi.leetcodeCatalog(), [], { cache: false });
  const sessionQuery = useInterviewQuery(`lc-session:${sessionId}`, () => interviewApi.session(sessionId), [sessionId], { cache: false });
  const command = useCommand(sessionId);
  const [pendingSlug, setPendingSlug] = import_react11.default.useState("");
  const [pendingProblem, setPendingProblem] = import_react11.default.useState(null);
  const [keyword, setKeyword] = import_react11.default.useState("");
  const [difficulties, setDifficulties] = import_react11.default.useState([]);
  const [category, setCategory] = import_react11.default.useState("");
  const [customOpen, setCustomOpen] = import_react11.default.useState(false);
  const catalogReload = import_react11.default.useRef(query.reload);
  catalogReload.current = query.reload;
  import_react11.default.useEffect(() => {
    let stopped = false;
    let timer;
    const refresh = async () => {
      try {
        await catalogReload.current();
      } finally {
        if (!stopped) timer = setTimeout(refresh, 5e3);
      }
    };
    timer = setTimeout(refresh, 5e3);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  if (query.loading && !query.data) return h("div", { className: "di-lc-catalog" }, h(Loading, { label: "\u6B63\u5728\u8BFB\u53D6\u529B\u6263\u9898\u5E93\u2026" }));
  if (query.error) return h("div", { className: "di-lc-catalog" }, h(ErrorNotice, null, query.error));
  const catalog = query.data?.resource?.data;
  if (!catalog) return null;
  const session = sessionQuery.data?.resource?.data;
  const activePractice = session?.selected && session.practice?.mode === "leetcode" ? session.practice : null;
  const activeLeetcode = Boolean(activePractice && activePractice.status === "active");
  const hostOutdated = !Array.isArray(catalog.difficulties) || catalog.difficulties.length === 0 || !catalog.difficultyTags;
  const needsConfig = !activeLeetcode || !activePractice.config?.guidance;
  const toggle = async (problem) => {
    setPendingSlug(problem.slug);
    try {
      await command.run("leetcode.set-completion", { slug: problem.slug, completed: !problem.completed });
      await query.reload();
    } catch {
    } finally {
      setPendingSlug("");
    }
  };
  const start = async (problem, selectionMode = "random") => {
    const prepared = { ...problem, category, difficulties, selectionMode };
    if (needsConfig) {
      setPendingProblem(prepared);
      return;
    }
    setPendingSlug(problem.slug || problem.title || "training-pool");
    try {
      const payload = {
        problem: prepared,
        selectionMode,
        config: { ...activePractice.config, category, difficulties }
      };
      const result = await (problem.trainingPool ? command.run("leetcode.train", payload) : command.run("leetcode.select", payload));
      await Promise.all([query.reload(), sessionQuery.reload()]);
      interviewApi.navigateWorkspace("active", { practiceId: result.resource.data.practice.id });
    } catch {
    } finally {
      setPendingSlug("");
    }
  };
  const startWithConfig = async (payload) => {
    if (!pendingProblem) return;
    try {
      const problem = { ...pendingProblem, category: payload.config.category || "", difficulties: payload.config.difficulties || [] };
      const request = { problem, config: payload.config, selectionMode: pendingProblem.selectionMode };
      const result = await (pendingProblem.trainingPool ? command.run("leetcode.train", request) : command.run("leetcode.select", request));
      setPendingProblem(null);
      await Promise.all([query.reload(), sessionQuery.reload()]);
      interviewApi.navigateWorkspace("active", { practiceId: result.resource.data.practice.id });
    } catch {
    }
  };
  if (pendingProblem) {
    return h(
      "section",
      { className: "di-lc-catalog", "aria-label": "\u4E3A\u6307\u5B9A\u9898\u76EE\u521B\u5EFA\u5237\u529B\u6263\u7EC3\u4E60" },
      h(
        "header",
        { className: "di-lc-catalog-head" },
        h(
          "div",
          { className: "di-lc-heading" },
          h("h2", { className: "di-lc-title" }, pendingProblem.trainingPool ? "\u5F00\u59CB\u4E13\u9898\u8BAD\u7EC3" : "\u5F00\u59CB\u8FD9\u9053\u9898"),
          h("span", { className: "di-lc-source" }, pendingProblem.trainingPool ? `${pendingProblem.category || "\u5168\u90E8\u4E13\u9898"} \xB7 ${leetcodeDifficultyTagsLabel(pendingProblem.difficulties)}` : `${pendingProblem.id ? `${pendingProblem.id}. ` : ""}${pendingProblem.title}`)
        )
      ),
      h(
        "div",
        { className: "di-lc-catalog-config" },
        activeLeetcode ? h("div", { className: "di-meta di-lc-config-note" }, "\u8FD9\u6761\u529B\u6263\u7EC3\u4E60\u662F\u5347\u7EA7\u524D\u521B\u5EFA\u7684\uFF0C\u53EA\u8BB0\u5F55\u4E86\u7F16\u7A0B\u8BED\u8A00\uFF1B\u8865\u9009\u5F15\u5BFC\u5F3A\u5EA6\u540E\u4F1A\u5F52\u6863\u65E7\u7EC3\u4E60\u5E76\u5F00\u59CB\u8FD9\u9053\u9898\u3002") : null,
        h(PracticeConfigForm, {
          initial: { mode: "leetcode", config: { ...activePractice ? activePractice.config : {}, category: pendingProblem.category, difficulties: pendingProblem.difficulties } },
          busy: command.busy === "leetcode.select" || command.busy === "leetcode.train",
          onSubmit: startWithConfig,
          onCancel: () => setPendingProblem(null),
          submitLabel: "\u5F00\u59CB\u7EC3\u4E60"
        })
      ),
      h(ErrorNotice, null, command.error)
    );
  }
  const problems = catalogProblems(catalog);
  const eligible = filterProblems(problems, { keyword: "", difficulties, category });
  const counts = Object.fromEntries(["easy", "medium", "hard"].map((id) => [id, problems.filter((problem) => (!category || problem.category === category) && problem.difficulty === id).length]));
  const filtered = filterProblems(problems, { keyword, difficulties, category });
  const visibleGroups = catalog.groups.map((group) => ({ ...group, problems: group.problems.filter((problem) => filtered.includes(problem)) })).filter((group) => group.problems.length > 0);
  const progress = catalog.total ? Math.round(catalog.completedCount / catalog.total * 100) : 0;
  const filtering = Boolean(keyword.trim() || difficulties.length || category);
  return h(
    "section",
    { className: "di-lc-catalog", "aria-label": "\u529B\u6263\u9898\u5E93" },
    h(
      "header",
      { className: "di-lc-catalog-head" },
      h(
        "div",
        { className: "di-lc-heading" },
        h("h2", { className: "di-lc-title" }, "\u9898\u5E93"),
        h("a", { className: "di-lc-source", href: catalog.source.url, target: "_blank", rel: "noreferrer" }, "\u70ED\u9898 100 \xB7 \u5B98\u65B9\u9898\u5355 \u2197")
      ),
      h(
        "div",
        { className: "di-lc-catalog-summary" },
        h("span", { className: "di-lc-progress-label" }, "\u5B8C\u6210\u8FDB\u5EA6"),
        h(
          "div",
          { className: "di-lc-progress-copy" },
          h("span", { className: "di-lc-progress-value" }, catalog.completedCount),
          h("span", null, `/ ${catalog.total}`)
        ),
        h(
          "div",
          { className: "di-lc-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": catalog.total, "aria-valuenow": catalog.completedCount },
          h("i", { style: { width: `${progress}%` } })
        )
      )
    ),
    h(
      "div",
      { className: "di-lc-toolbar" },
      h("input", {
        className: "di-input di-lc-search",
        value: keyword,
        placeholder: "\u641C\u9898\u53F7\u3001\u9898\u540D\u6216\u9898\u578B\uFF0C\u4F8B\u5982 33 / \u4E8C\u5206 / two-sum",
        "aria-label": "\u641C\u7D22\u529B\u6263\u9898\u76EE",
        onChange: (event) => setKeyword(event.target.value)
      }),
      h(Select, {
        className: "di-lc-filter-select",
        value: category,
        options: [{ value: "", label: "\u5168\u90E8\u4E13\u9898" }, ...(catalog.categories || []).map((item) => ({ value: item, label: item }))],
        onChange: setCategory,
        "aria-label": "\u6309\u9898\u578B\u7B5B\u9009"
      }),
      h(Button, { onClick: () => setCustomOpen((value) => !value), disabled: hostOutdated }, customOpen ? "\u6536\u8D77\u81EA\u5B9A\u4E49" : "\u81EA\u5B9A\u4E49\u9898\u76EE")
    ),
    hostOutdated ? h("div", { className: "di-notice" }, "\u68C0\u6D4B\u5230\u63D2\u4EF6\u540E\u7AEF\u4ECD\u662F\u65E7\u7248\u672C\uFF1A\u641C\u7D22\u9009\u9898\u3001\u63D0\u793A\u9636\u68AF\u548C\u6750\u6599\u5361\u9700\u8981\u91CD\u542F dsh web \u540E\u751F\u6548\u3002") : null,
    customOpen ? h(CustomProblemForm, { disabled: command.busy === "leetcode.select", busy: false, onStart: start }) : null,
    h(DifficultyTags, { value: difficulties, onChange: setDifficulties, counts, label: "\u6309\u96BE\u5EA6\u7B5B\u9009", disabled: hostOutdated || Boolean(command.busy) }),
    h(
      "div",
      { className: "di-training-catalog-actions" },
      h("span", { className: "di-meta", role: "status" }, `${category || "\u5168\u90E8\u4E13\u9898"} \xB7 ${leetcodeDifficultyTagsLabel(difficulties)} \xB7 ${eligible.length} \u9053\u9898`),
      h(Button, { tone: "primary", disabled: hostOutdated || !sessionId || !eligible.length || Boolean(command.busy), onClick: () => start({ trainingPool: true }, "ordered") }, "\u6309\u4E13\u9898\u987A\u5E8F\u8BAD\u7EC3"),
      h(Button, { disabled: hostOutdated || !sessionId || !eligible.length || Boolean(command.busy), onClick: () => start({ trainingPool: true }, "random") }, "\u968F\u673A\u8BAD\u7EC3")
    ),
    h(
      "div",
      { className: "di-lc-toolbar-note" },
      h("span", { className: "di-meta" }, filtering ? `\u7B5B\u9009\u51FA ${filtered.length} \u9053\u9898` : "\u70B9\u300C\u505A\u8FD9\u9898\u300D\u76F4\u63A5\u5F00\u59CB\uFF1B\u5DF2\u6709\u8FDB\u884C\u4E2D\u7684\u529B\u6263\u7EC3\u4E60\u65F6\u4F1A\u81EA\u52A8\u7ED3\u675F\u5B83\u5E76\u5207\u5230\u65B0\u9898\u3002")
    ),
    h("div", { className: "di-meta di-lc-toolbar-note" }, "\u4F5C\u7B54\u7ECF AI \u70B9\u8BC4\uFF0C\u6216\u7ED3\u675F\u5DF2\u6709\u4F5C\u7B54\u7684\u7EC3\u4E60\u540E\u81EA\u52A8\u6253\u52FE\uFF1B\u52FE\u9009\u8868\u793A\u7EC3\u4E60\u8FC7\uFF0C\u53EF\u624B\u52A8\u8C03\u6574\u3002"),
    h(ErrorNotice, null, command.error),
    !visibleGroups.length ? h(Empty, { title: "\u6CA1\u6709\u5339\u914D\u7684\u9898\u76EE", detail: "\u6362\u4E2A\u5173\u952E\u5B57\uFF0C\u6216\u8005\u7528\u300C\u81EA\u5B9A\u4E49\u9898\u76EE\u300D\u70B9\u540D\u4E00\u9053\u70ED\u9898 100 \u4E4B\u5916\u7684\u9898\u3002" }) : h("div", { className: "di-lc-groups" }, visibleGroups.map((group) => h(CatalogGroup, {
      key: group.category,
      group,
      pendingSlug,
      disabled: hostOutdated,
      onToggle: toggle,
      onStart: start
    })))
  );
}
function MaterialsBlock({ question }) {
  const materials = question.materials;
  if (!materials) return null;
  const revealed = question.hintTotal ? Math.min(question.hintLevel || 0, question.hintTotal) : 0;
  return h(
    "div",
    { className: "di-lc-materials" },
    h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u9898\u610F"),
      h(Markdown, null, materials.statement)
    ),
    materials.examples?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u793A\u4F8B"),
      h("div", { className: "di-lc-examples" }, materials.examples.map((example, index) => h(
        "div",
        { className: "di-lc-example", key: index },
        h("div", null, h("span", null, "\u8F93\u5165"), h("code", null, example.input)),
        h("div", null, h("span", null, "\u8F93\u51FA"), h("code", null, example.output)),
        example.note ? h("div", null, h("span", null, "\u8BF4\u660E"), h("span", null, example.note)) : null
      )))
    ) : null,
    materials.constraints?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u6570\u636E\u8303\u56F4"),
      h("ul", { className: "di-lc-chips" }, materials.constraints.map((item, index) => h("li", { key: index }, h("code", null, item))))
    ) : null,
    materials.knowledge?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u524D\u7F6E\u77E5\u8BC6"),
      materials.knowledge.map((item) => h(
        "div",
        { className: "di-lc-knowledge", key: item.title },
        h("div", { className: "di-lc-knowledge-title" }, item.title),
        h(Markdown, null, item.detail)
      ))
    ) : null,
    materials.hints?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, `\u63D0\u793A\u9636\u68AF ${revealed}/${materials.hints.length}`),
      h("ol", { className: "di-lc-hints" }, materials.hints.map((hint, index) => h("li", {
        key: index,
        className: index < revealed ? "is-revealed" : "is-locked"
      }, index < revealed ? h(Markdown, null, hint) : "\u672A\u89E3\u9501\uFF0C\u70B9\u300C\u63D0\u793A\u300D\u9010\u6B65\u6253\u5F00")))
    ) : null,
    materials.pitfalls?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u5E38\u89C1\u8BEF\u533A"),
      h("ul", null, materials.pitfalls.map((item, index) => h("li", { key: index }, item)))
    ) : null,
    materials.related?.length ? h(
      "div",
      { className: "di-lc-material-block" },
      h("div", { className: "di-lc-material-label" }, "\u76F8\u4F3C\u9898"),
      h("ul", { className: "di-lc-related" }, materials.related.map((item) => h(
        "li",
        { key: `${item.id}-${item.title}` },
        h("a", { className: "di-link", href: item.url, target: "_blank", rel: "noreferrer" }, `${item.id ? `${item.id}. ` : ""}${item.title}`)
      )))
    ) : null,
    materialsSourceLine(materials.source) ? h("div", { className: "di-lc-material-source" }, materialsSourceLine(materials.source)) : null
  );
}
function ProblemPicker({ catalog, busy, consumedBy, onPick, onClose, initialCategory = "", initialDifficulties = [] }) {
  const [keyword, setKeyword] = import_react11.default.useState("");
  const [category, setCategory] = import_react11.default.useState(initialCategory);
  const [difficulties, setDifficulties] = import_react11.default.useState(initialDifficulties);
  const problems = filterProblems(catalogProblems(catalog), { keyword, difficulties, category });
  const eligible = filterProblems(catalogProblems(catalog), { keyword: "", difficulties, category });
  const visible = problems.slice(0, 8);
  return h(
    "section",
    { className: "di-lc-picker", "aria-label": "\u6362\u4E00\u9053\u9898" },
    h(
      "div",
      { className: "di-lc-toolbar" },
      h("input", {
        className: "di-input di-lc-search",
        value: keyword,
        placeholder: "\u641C\u9898\u53F7\u3001\u9898\u540D\u6216\u9898\u578B",
        "aria-label": "\u641C\u7D22\u8981\u505A\u7684\u9898\u76EE",
        onChange: (event) => setKeyword(event.target.value)
      }),
      h(Select, { className: "di-lc-filter-select", value: category, options: [{ value: "", label: "\u5168\u90E8\u4E13\u9898" }, ...(catalog?.categories || []).map((name2) => ({ value: name2, label: name2 }))], onChange: setCategory, disabled: busy, "aria-label": "\u9009\u62E9\u4E0B\u4E00\u9898\u4E13\u9898" }),
      h(Button, { disabled: busy, onClick: onClose }, "\u6536\u8D77")
    ),
    h(DifficultyTags, { value: difficulties, onChange: setDifficulties, disabled: busy, label: "\u9009\u62E9\u4E0B\u4E00\u9898\u96BE\u5EA6\u6807\u7B7E" }),
    visible.length ? h("div", { className: "di-lc-picker-list" }, visible.map((problem) => h(
      "button",
      {
        type: "button",
        className: "di-lc-picker-row",
        key: problem.slug,
        disabled: busy,
        onClick: () => onPick({ slug: problem.slug, category, difficulties })
      },
      h("span", { className: "di-lc-problem-id" }, problem.id),
      h("span", { className: "di-lc-picker-title" }, problem.title),
      h(DifficultyBadge, { difficulty: problem.difficulty })
    ))) : h("div", { className: "di-empty" }, h("div", { className: "di-empty-title" }, "\u6CA1\u6709\u5339\u914D\u7684\u9898\u76EE")),
    h(
      "div",
      { className: "di-lc-picker-foot" },
      h(Button, {
        disabled: busy || !eligible.length,
        onClick: () => onPick({ category, difficulties, selectionMode: "ordered" })
      }, consumedBy === "question.next" ? "\u5DF2\u51FA\u4E0B\u4E00\u9898" : "\u6309\u4E13\u9898\u987A\u5E8F\u4E0B\u4E00\u9053"),
      h(Button, { disabled: busy || !eligible.length, onClick: () => onPick({ category, difficulties, selectionMode: "random" }) }, "\u968F\u673A\u4E0B\u4E00\u9053"),
      problems.length > visible.length ? h("span", { className: "di-meta" }, `\u8FD8\u6709 ${problems.length - visible.length} \u9053\u9898\uFF0C\u7EE7\u7EED\u8F93\u5165\u7F29\u5C0F\u8303\u56F4`) : null
    )
  );
}
function LeetcodeQuestionCard({
  sessionId,
  artifact,
  question,
  catalog,
  language,
  active,
  command,
  transition,
  onRun,
  onNext,
  onExplain,
  onHint,
  onGenerateMaterials,
  pendingMaterials,
  trainingConfig
}) {
  const problem = question.leetcode;
  const materials = question.materials;
  const saved = catalogProblem(catalog, problem.slug);
  const completed = saved?.completed === true;
  const hintTotal = question.hintTotal || 0;
  const hintLevel = question.hintLevel || 0;
  const [showMaterials, setShowMaterials] = import_react11.default.useState(false);
  const [pickerOpen, setPickerOpen] = import_react11.default.useState(false);
  return h(
    "article",
    { className: `di-card di-lc-problem-card${active ? " is-active" : " is-history"}`, "aria-label": active ? "\u5F53\u524D\u529B\u6263\u9898\u76EE" : "\u5386\u53F2\u529B\u6263\u9898\u76EE" },
    h(
      "div",
      { className: "di-lc-problem-main" },
      h("div", { className: "di-lc-problem-title" }, problem.id ? h("span", null, problem.id) : null, problem.title),
      h(
        "div",
        { className: "di-lc-problem-meta" },
        h("span", null, problem.category),
        h(DifficultyBadge, { difficulty: problem.difficulty, custom: Boolean(problem.custom) }),
        language ? h("span", null, leetcodeLanguageLabel(language)) : null,
        h(GuidanceBadge, { guidance: question.guidance }),
        problem.slug ? h("span", { className: completed ? "is-complete" : "" }, completed ? "\u5DF2\u5B8C\u6210" : "\u672A\u5B8C\u6210") : null
      )
    ),
    h(
      "div",
      { className: "di-lc-problem-actions" },
      h("a", { className: "di-button is-primary", href: problem.url, target: "_blank", rel: "noreferrer" }, "\u6253\u5F00\u9898\u76EE \u2197"),
      active ? h(
        import_react11.default.Fragment,
        null,
        materials && hintTotal ? h(Button, {
          disabled: transition.locked || pendingMaterials || hintLevel >= hintTotal,
          busy: command.busy === "question.hint",
          onClick: () => onHint()
        }, hintLevel >= hintTotal ? `\u63D0\u793A\u5DF2\u7528\u5B8C ${hintTotal}/${hintTotal}` : `\u63D0\u793A ${hintLevel}/${hintTotal}`) : h(Button, {
          disabled: transition.locked || pendingMaterials,
          busy: command.busy === "question.materials" || pendingMaterials,
          onClick: () => onGenerateMaterials()
        }, pendingMaterials ? "\u6B63\u5728\u751F\u6210\u6750\u6599\u2026" : "\u751F\u6210\u9898\u76EE\u6750\u6599"),
        !question.explanation ? h(Button, {
          disabled: transition.locked,
          busy: command.busy === "question.reveal",
          onClick: () => onExplain(question)
        }, "\u770B\u7B54\u6848") : null,
        h(Button, { disabled: transition.locked, onClick: () => setPickerOpen((value) => !value) }, pickerOpen ? "\u6536\u8D77\u9009\u9898" : "\u6362\u4E00\u9898"),
        problem.slug ? h(Button, {
          disabled: transition.locked,
          busy: command.busy === "leetcode.set-completion",
          onClick: () => onRun("leetcode.set-completion", { slug: problem.slug, completed: !completed })
        }, completed ? "\u6807\u8BB0\u672A\u5B8C\u6210" : "\u6807\u8BB0\u5B8C\u6210") : null
      ) : null
    ),
    materials ? h(
      "div",
      { className: "di-lc-material-actions" },
      h(Button, { onClick: () => setShowMaterials((value) => !value) }, showMaterials ? "\u6536\u8D77\u9898\u76EE\u6750\u6599" : "\u67E5\u770B\u9898\u76EE\u6750\u6599"),
      h("span", { className: "di-meta" }, "\u6750\u6599\u540C\u65F6\u4EE5 dsh-ui \u5361\u7247\u5C55\u793A\u5728\u5BF9\u8BDD\u91CC")
    ) : null,
    pickerOpen && active ? h(ProblemPicker, {
      catalog,
      busy: transition.locked || command.busy === "question.next",
      consumedBy: transition.consumedBy,
      onPick: (selection) => onNext(selection),
      onClose: () => setPickerOpen(false),
      initialCategory: trainingConfig?.category || "",
      initialDifficulties: trainingConfig?.difficulties || []
    }) : null,
    active && pendingMaterials ? h("div", { className: "di-notice" }, "\u6B63\u5728\u751F\u6210\u9898\u76EE\u6750\u6599\u4E0E\u63D0\u793A\u9636\u68AF\uFF0C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC\u3002") : null,
    active ? h(ErrorNotice, null, command.error) : null,
    h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: artifact.practiceId, question }),
    h(QuestionSolutionPanel, { key: `solution:${question.id}`, sessionId, practiceId: artifact.practiceId, question, canGenerate: active }),
    active || question.attempts?.length ? h(CodeAnswerEditor, {
      key: question.id,
      sessionId,
      question,
      artifact,
      language,
      disabled: transition.locked
    }) : null,
    showMaterials && materials ? h("section", { className: "di-section di-lc-material-section", "aria-label": "\u9898\u76EE\u6750\u6599" }, h(MaterialsBlock, { question })) : null
  );
}
function LeetcodeProblemCard({ sessionId, initialQuestion = null, artifact, language = "", resourceRevision = 0, onRefresh = null }) {
  const sessionQuery = useInterviewQuery(`session:${sessionId}:${artifact.presentationId}`, () => interviewApi.session(sessionId), [sessionId, artifact.presentationId, resourceRevision], { version: resourceRevision, cache: false });
  const catalogQuery = useInterviewQuery("leetcode-catalog-current", () => interviewApi.leetcodeCatalog(), [], { cache: false });
  const command = useCommand(sessionId);
  const session = sessionQuery.data?.resource?.data;
  const current = initialQuestion;
  const [pendingMaterials, setPendingMaterials] = import_react11.default.useState(false);
  const [pollTick, setPollTick] = import_react11.default.useState(0);
  const refreshRef = import_react11.default.useRef(null);
  const artifactActive = isCardActive(session, artifact);
  const transition = useCardTransition(command.run, artifact, !artifactActive);
  refreshRef.current = () => {
    onRefresh?.();
    sessionQuery.reload();
  };
  import_react11.default.useEffect(() => {
    setPendingMaterials(false);
    setPollTick(0);
  }, [current?.id]);
  import_react11.default.useEffect(() => {
    if (pendingMaterials && current?.materials) setPendingMaterials(false);
  }, [pendingMaterials, current?.materials]);
  import_react11.default.useEffect(() => {
    if (!pendingMaterials || current?.materials || pollTick >= 8) return void 0;
    const timer = setTimeout(() => {
      refreshRef.current?.();
      setPollTick((value) => value + 1);
    }, 2500);
    return () => clearTimeout(timer);
  }, [pendingMaterials, current?.materials, pollTick]);
  if (sessionQuery.loading && !current) return h("div", { className: "di-card" }, h(Loading));
  if (!current?.leetcode) return null;
  const run = async (name2, payload) => {
    try {
      const result = await command.run(name2, payload);
      await Promise.all([sessionQuery.reload(), catalogQuery.reload(), Promise.resolve(onRefresh?.())]);
      return result;
    } catch {
      return null;
    }
  };
  const explain = async () => {
    if (current.explanation) return;
    await transition.run("question.reveal");
  };
  const next = (selection = null) => transition.run("question.next", selection || {});
  const hint = async () => {
    const result = await run("question.hint", { questionId: current.id });
    if (result?.resource?.kind === "materials-pending") {
      setPollTick(0);
      setPendingMaterials(true);
    }
  };
  const generateMaterials = async () => {
    const result = await run("question.materials", { questionId: current.id });
    if (result?.resource?.kind === "materials-pending") {
      setPollTick(0);
      setPendingMaterials(true);
    }
  };
  const catalog = catalogQuery.data?.resource?.data;
  const active = artifactActive;
  return h(LeetcodeQuestionCard, {
    sessionId,
    artifact,
    question: { ...current, guidance: session?.practice?.config?.guidance || null },
    catalog,
    language: language || session?.practice?.config?.language,
    active,
    command,
    transition,
    onRun: run,
    onNext: next,
    onExplain: explain,
    onHint: hint,
    onGenerateMaterials: generateMaterials,
    pendingMaterials,
    trainingConfig: session?.practice?.config
  });
}

// src/client/features/live-interview.js
function CompactResultCard({ title, detail }) {
  return h(
    "div",
    { className: "di-card" },
    h(
      "div",
      { className: "di-card-head" },
      h("div", { className: "di-title" }, title)
    ),
    detail ? h("div", { className: "di-card-body" }, detail) : null
  );
}
function QuestionResultCard({ sessionId, question, artifact, answerDisabled = false }) {
  if (!question) return null;
  const command = useCommand(sessionId);
  const transition = useCardTransition(command.run, artifact, answerDisabled);
  const allowReveal = question.capabilities?.allowReveal !== false;
  const [codeOpen, setCodeOpen] = import_react12.default.useState(Boolean(question.hot100));
  return h(
    "article",
    { className: "di-card di-question-card", "aria-label": "\u9762\u8BD5\u9898" },
    h(
      "div",
      { className: "di-question-main" },
      h("div", { className: "di-question-text" }, h(Markdown, null, question.prompt))
    ),
    h(
      "div",
      { className: "di-question-actions" },
      h(Button, { onClick: () => setCodeOpen((value) => !value) }, h(Icon, { name: "code" }), codeOpen ? "\u6536\u8D77\u4EE3\u7801" : "\u5199\u4EE3\u7801"),
      allowReveal ? h(Button, {
        className: "di-answer-button",
        disabled: transition.locked,
        busy: command.busy === "question.reveal",
        onClick: () => transition.run("question.reveal"),
        "aria-label": "\u67E5\u770B\u672C\u9898\u7B54\u6848"
      }, h(Icon, { name: "eye" }), "\u770B\u7B54\u6848") : h(Button, {
        className: "di-answer-button",
        disabled: transition.locked,
        busy: command.busy === "session.finish",
        onClick: () => transition.run("session.finish")
      }, "\u7ED3\u675F\u9762\u8BD5")
    ),
    question.hot100 ? h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: artifact.practiceId, question }) : null,
    allowReveal ? h(QuestionSolutionPanel, { key: `solution:${question.id}`, sessionId, practiceId: artifact.practiceId, question, canGenerate: !answerDisabled }) : null,
    codeOpen ? h(CodeAnswerEditor, { key: question.id, sessionId, question, artifact, disabled: transition.locked }) : null,
    h(ErrorNotice, null, command.error)
  );
}
function ReviewResultCard({ sessionId, question, attempt, artifact, actionsDisabled = false }) {
  if (!question || !question.explanation || attempt && !attempt.evaluation) return null;
  const command = useCommand(sessionId);
  const transition = useCardTransition(command.run, artifact, actionsDisabled);
  const evaluation = attempt?.evaluation || null;
  const explanation = question.explanation;
  const isLeetcode = Boolean(question.leetcode);
  return h(
    "article",
    { id: `di-review-${question.id}`, className: "di-card di-review-card", "aria-label": isLeetcode ? "\u9898\u76EE\u8BB2\u89E3" : "\u70B9\u8BC4\u8BB2\u89E3" },
    evaluation ? h(
      "header",
      { className: "di-review-score" },
      h("span", { className: "di-review-check" }, h(Icon, { name: "check", size: 22 })),
      h(
        "div",
        { className: "di-review-score-summary" },
        h("div", { className: "di-review-score-label" }, "\u8BC4\u5206"),
        h(
          "div",
          { className: "di-review-score-value" },
          h("span", { className: "di-review-score-number" }, Number(evaluation.score).toFixed(1)),
          h("span", null, "/ 10")
        )
      ),
      h(StarRating, { score: evaluation.score })
    ) : null,
    h(
      "div",
      { className: "di-review-content" },
      evaluation ? h(
        "section",
        { className: "di-review-section" },
        h("h3", null, "\u8BC4\u4EF7"),
        h("div", { className: "di-feedback-banner" }, h(Markdown, null, evaluation.feedback)),
        Object.keys(evaluation.dimensions || {}).length ? h("div", { className: "di-dimensions" }, Object.entries(evaluation.dimensions).map(([name2, score]) => h("span", { key: name2 }, name2, h("span", { className: "di-dimension-score" }, `${score}/10`)))) : null
      ) : null,
      h(
        SolutionDisclosure,
        { key: `${question.id}:${explanation.createdAt}` },
        h(
          "section",
          { className: "di-review-section" },
          h("h3", null, "\u8BB2\u89E3"),
          h("div", { className: "di-explanation-copy" }, h(Markdown, null, explanation.detail))
        ),
        h(
          "section",
          { className: "di-memorize-box" },
          h(
            "div",
            { className: "di-memorize-copy" },
            h("div", { className: "di-memorize-label" }, isLeetcode ? "\u89E3\u9898\u8981\u70B9" : "\u76F4\u63A5\u80CC"),
            h(Markdown, null, explanation.memorizationPoints)
          )
        )
      ),
      h(ErrorNotice, null, command.error),
      h(
        "div",
        { className: "di-review-actions" },
        isLeetcode ? h(Button, { tone: "primary", disabled: transition.locked, onClick: () => transition.run("question.next") }, transition.consumedBy === "question.next" ? "\u5DF2\u51FA\u4E0B\u4E00\u9898" : "\u968F\u673A\u4E0B\u4E00\u9898") : h(Button, { tone: "primary", disabled: transition.locked, busy: command.busy === "question.next", onClick: () => transition.run("question.next") }, "\u4E0B\u4E00\u9898"),
        !isLeetcode ? h(Button, { disabled: transition.locked, busy: command.busy === "question.retry", onClick: () => transition.run("question.retry") }, h(Icon, { name: "swap" }), "\u91CD\u65B0\u4F5C\u7B54") : null,
        isLeetcode ? h(Button, { disabled: transition.locked, busy: command.busy === "question.retry", onClick: () => transition.run("question.retry") }, h(Icon, { name: "code" }), "\u4FEE\u6539\u4EE3\u7801") : null,
        !isLeetcode ? h(Button, { disabled: transition.locked, busy: command.busy === "session.finish", onClick: () => transition.run("session.finish") }, "\u7ED3\u675F\u7EC3\u4E60") : null
      )
    )
  );
}
function ToolErrorCard({ message }) {
  return h(
    "div",
    { className: "di-tool-error", role: "alert" },
    h("span", null, "\u9762\u8BD5\u64CD\u4F5C\u5931\u8D25"),
    h("span", null, message)
  );
}
function useArtifactPractice(artifact, revision) {
  const practiceId = artifact?.practiceId;
  return useInterviewQuery(
    `practice:${practiceId || "none"}:${artifact?.presentationId || "none"}`,
    () => practiceId ? interviewApi.practice(practiceId) : Promise.resolve(null),
    [practiceId, artifact?.presentationId, revision],
    { version: revision, cache: false }
  );
}
function useArtifactSession(sessionId, artifact, revision) {
  return useInterviewQuery(
    `session:${sessionId}:${artifact?.presentationId || "none"}`,
    () => interviewApi.session(sessionId),
    [sessionId, artifact?.presentationId, revision],
    { version: revision, cache: false }
  );
}
function ArtifactState({ query, children, missing }) {
  if (query.loading && !query.data) return h("div", { className: "di-card" }, h(Loading));
  if (query.error) return h("div", { className: "di-card" }, h(ErrorNotice, null, query.error));
  return children || h("div", { className: "di-card" }, h(Empty, { title: missing }));
}
function QuestionResourceCard({ artifact, revision, sessionId }) {
  const query = useArtifactPractice(artifact, revision);
  const sessionQuery = useArtifactSession(sessionId, artifact, revision);
  const practice = query.data?.resource?.data;
  const session = sessionQuery.data?.resource?.data;
  const question = practice?.questions?.find((item) => item.id === artifact.questionId);
  const active = isCardActive(session, artifact);
  return h(ArtifactState, { query, missing: "\u627E\u4E0D\u5230\u9898\u76EE\u5361\u7247\u6570\u636E" }, question ? question.leetcode ? h(LeetcodeProblemCard, {
    sessionId,
    initialQuestion: question,
    artifact,
    language: practice.config?.language,
    resourceRevision: revision,
    onRefresh: () => query.reload()
  }) : h(QuestionResultCard, { sessionId, question, artifact, answerDisabled: !active }) : null);
}
function ReviewResourceCard({ artifact, revision, sessionId }) {
  const query = useArtifactPractice(artifact, revision);
  const sessionQuery = useArtifactSession(sessionId, artifact, revision);
  const practice = query.data?.resource?.data;
  const session = sessionQuery.data?.resource?.data;
  const question = practice?.questions?.find((item) => item.id === artifact.questionId);
  const attempt = artifact.attemptId ? question?.attempts?.find((item) => item.id === artifact.attemptId) : null;
  const complete = question?.explanation && (!artifact.attemptId || attempt?.evaluation);
  const active = isCardActive(session, artifact);
  return h(ArtifactState, { query, missing: "\u627E\u4E0D\u5230\u8BB2\u89E3\u6570\u636E" }, complete ? h(ReviewResultCard, { sessionId, question, attempt, artifact, actionsDisabled: !active }) : null);
}
function PracticeSummaryCard({ artifact, revision }) {
  const query = useArtifactPractice(artifact, revision);
  const practice = query.data?.resource?.data;
  const summary = practice?.summary;
  const leetcode = summary?.kind === "leetcode";
  return h(ArtifactState, { query, missing: "\u627E\u4E0D\u5230\u7EC3\u4E60\u603B\u7ED3" }, summary ? h(
    "article",
    { className: "di-card", "aria-label": "\u7EC3\u4E60\u603B\u7ED3" },
    h(
      "header",
      { className: "di-card-head" },
      h("div", { className: "di-title" }, "\u7EC3\u4E60\u603B\u7ED3")
    ),
    h(
      "div",
      { className: "di-card-body" },
      leetcode ? h(
        import_react12.default.Fragment,
        null,
        h("div", { className: "di-meta" }, `\u672C\u6B21\u5171\u8BB0\u5F55 ${summary.questionCount} \u9053\u9898`),
        h("ol", null, summary.problems.map((problem) => h(
          "li",
          { key: `${problem.sequence}-${problem.slug}` },
          h("a", { className: "di-link", href: problem.url, target: "_blank", rel: "noreferrer" }, `${problem.id}. ${problem.title}`),
          ` \xB7 ${problem.category} \xB7 ${leetcodeDifficultyLabel(problem.difficulty)}`
        )))
      ) : h(
        import_react12.default.Fragment,
        null,
        h(Markdown, null, summary.overall),
        h(
          "section",
          { className: "di-section" },
          h("div", { className: "di-section-label" }, "\u8868\u73B0\u4EAE\u70B9"),
          h("ul", null, summary.strengths.map((item) => h("li", { key: item }, item)))
        ),
        h(
          "section",
          { className: "di-section" },
          h("div", { className: "di-section-label" }, "\u6539\u8FDB\u5EFA\u8BAE"),
          h("ul", null, summary.improvements.map((item) => h("li", { key: item }, item)))
        ),
        h("div", { className: "di-meta" }, `${practice.questionCount} \u9053\u9898 \xB7 ${practice.attemptCount} \u6B21\u4F5C\u7B54 \xB7 \u5E73\u5747\u5206 ${practice.averageScore ?? "\u2014"}`)
      )
    )
  ) : null);
}

// src/client/features/practice-library.js
var import_react14 = __toESM(require("react"), 1);

// src/client/features/leetcode-training.js
var import_react13 = __toESM(require("react"), 1);
function LeetcodeTrainingControls({ practice, sessionId, busy, onNext }) {
  const [category, setCategory] = import_react13.default.useState(practice.config.category || "");
  const [difficulties, setDifficulties] = import_react13.default.useState(practice.config.difficulties || []);
  const query = useInterviewQuery("leetcode-training-catalog", () => interviewApi.leetcodeCatalog(), [], { cache: false });
  const catalog = query.data?.resource?.data;
  const eligible = (catalog?.groups || []).flatMap((group) => group.problems).filter((problem) => !category || problem.category === category);
  const count = eligible.filter((problem) => !difficulties.length || difficulties.includes(problem.difficulty)).length;
  const counts = Object.fromEntries(["easy", "medium", "hard"].map((id) => [id, eligible.filter((problem) => problem.difficulty === id).length]));
  const disabled = Boolean(busy) || !sessionId || !catalog?.difficultyTags || count === 0;
  return h(
    "section",
    { className: "di-training-controls", "aria-label": "\u4E13\u9898\u4E0E\u96BE\u5EA6\u8BAD\u7EC3" },
    h(
      "div",
      { className: "di-training-heading" },
      h("span", null, "\u9009\u62E9\u4E0B\u4E00\u9053\u7684\u8BAD\u7EC3\u8303\u56F4"),
      h(Select, { value: category, options: [{ value: "", label: "\u5168\u90E8\u4E13\u9898" }, ...(catalog?.categories || []).map((name2) => ({ value: name2, label: name2 }))], disabled: Boolean(busy), onChange: setCategory, "aria-label": "\u8BAD\u7EC3\u4E13\u9898" })
    ),
    h(DifficultyTags, { value: difficulties, onChange: setDifficulties, counts, disabled: Boolean(busy) }),
    h("div", { className: "di-meta", role: "status" }, `${category || "\u5168\u90E8\u4E13\u9898"} \xB7 ${leetcodeDifficultyTagsLabel(difficulties)} \xB7 ${count} \u9053\u9898`),
    catalog && !count ? h("div", { className: "di-notice" }, "\u6240\u9009\u4E13\u9898\u548C\u96BE\u5EA6\u6CA1\u6709\u9898\u76EE\uFF0C\u8BF7\u8C03\u6574\u8BAD\u7EC3\u8303\u56F4\u3002") : null,
    h(
      "div",
      { className: "di-training-actions" },
      h(Button, { tone: "primary", disabled, busy: busy === "ordered", onClick: () => onNext({ category, difficulties, selectionMode: "ordered" }) }, "\u6309\u4E13\u9898\u987A\u5E8F\u4E0B\u4E00\u9053"),
      h(Button, { disabled, busy: busy === "random", onClick: () => onNext({ category, difficulties, selectionMode: "random" }) }, "\u968F\u673A\u4E0B\u4E00\u9053")
    ),
    h("div", { className: "di-meta" }, "\u987A\u5E8F\u51FA\u9898\u6309\u4E13\u9898\u4E2D\u7684\u9898\u5E93\u987A\u5E8F\uFF0C\u5230\u672B\u5C3E\u540E\u4ECE\u7B2C\u4E00\u9053\u7EE7\u7EED\u3002"),
    h(ErrorNotice, null, query.error)
  );
}

// src/client/features/practice-library.js
function PracticeDetail({ practice, sessionId, onDeleted, onAdvanced, initialCodeContext = null }) {
  const command = useCommand(sessionId);
  const [confirming, setConfirming] = import_react14.default.useState(false);
  const [editing, setEditing] = import_react14.default.useState(false);
  const [editingQuestionId, setEditingQuestionId] = import_react14.default.useState(null);
  const [questionDraft, setQuestionDraft] = import_react14.default.useState("");
  const [deletingQuestionId, setDeletingQuestionId] = import_react14.default.useState(null);
  const [downloads, setDownloads] = import_react14.default.useState([]);
  const [codeContext, setCodeContext] = import_react14.default.useState(initialCodeContext);
  const [advancingMode, setAdvancingMode] = import_react14.default.useState("");
  const detailRef = import_react14.default.useRef(null);
  import_react14.default.useEffect(() => {
    if (initialCodeContext?.practiceId === practice?.id) {
      setCodeContext(initialCodeContext);
      detailRef.current?.scrollIntoView({ block: "start" });
    }
  }, [initialCodeContext, practice?.id]);
  if (!practice) return h(Empty, { title: "\u9009\u62E9\u4E00\u6761\u7EC3\u4E60", detail: "\u53F3\u4FA7\u4F1A\u5C55\u793A\u9898\u76EE\u3001\u5386\u6B21\u4F5C\u7B54\u548C\u8BB2\u89E3\u3002" });
  const run = (name2, payload) => command.run(name2, payload).catch(() => null);
  const activate = async () => {
    const result = await run(practice.status === "completed" ? "session.reopen" : "session.select", { practiceId: practice.id });
    if (result) interviewApi.navigateWorkspace("active");
  };
  const exportOne = async () => {
    const result = await run("library.export", { practiceIds: [practice.id] });
    if (result) setDownloads(result.resource.data || []);
  };
  const remove = async () => {
    const result = await run("library.delete", { practiceId: practice.id });
    if (result) onDeleted();
  };
  const updateConfiguration = async (payload) => {
    const result = await run("practice.update", { practiceId: practice.id, ...payload });
    if (result) setEditing(false);
  };
  const updateQuestion = async (questionId) => {
    const result = await run("question.update", { practiceId: practice.id, questionId, prompt: questionDraft });
    if (result) {
      setEditingQuestionId(null);
      setQuestionDraft("");
    }
  };
  const deleteQuestion = async (questionId) => {
    const result = await run("question.delete", { practiceId: practice.id, questionId });
    if (result) setDeletingQuestionId(null);
  };
  const retry = async (questionId) => {
    if (practice.status !== "active") return;
    await run("question.focus", { practiceId: practice.id, questionId });
  };
  const openCode = async (questionId) => {
    const result = await run("question.code-open", { practiceId: practice.id, questionId });
    const session = result?.resource?.data;
    if (!session) return;
    setCodeContext({
      practiceId: practice.id,
      questionId,
      presentationId: `workspace-code:${session.revision}:${Date.now()}`,
      sessionRevision: session.revision
    });
  };
  const nextLeetcode = async (options) => {
    setAdvancingMode(options.selectionMode);
    try {
      const result = await run("leetcode.practice-next", { practiceId: practice.id, ...options });
      const next = result?.resource?.data;
      if (!next?.practice || !next.currentQuestionId) return;
      onAdvanced(next);
    } finally {
      setAdvancingMode("");
    }
  };
  return h(
    "section",
    { className: "di-detail", ref: detailRef },
    h(
      "div",
      { className: "di-detail-heading" },
      h("h3", { className: "di-ledger-title" }, practice.topic),
      h("span", { className: "di-meta" }, practice.mode === "leetcode" ? `${practice.modeLabel} \xB7 ${leetcodeLanguageLabel(practice.config.language)} \xB7 ${leetcodeGuidanceLabel(practice.config.guidance)}` : `${practice.modeLabel} \xB7 ${practice.questionCount} \u9898 \xB7 ${practice.evaluatedCount} \u6B21\u5DF2\u8BC4\u4EF7 \xB7 \u5747\u5206 ${practice.averageScore ?? "\u2014"}`)
    ),
    h(
      "div",
      { className: "di-actions" },
      h(Button, { tone: "primary", busy: Boolean(command.busy?.startsWith("session.")), onClick: activate }, practice.status === "completed" ? "\u91CD\u65B0\u6253\u5F00" : "\u5207\u6362\u5230\u7EC3\u4E60"),
      h(Button, { onClick: () => setEditing((value) => !value) }, "\u7F16\u8F91\u914D\u7F6E"),
      h(Button, { busy: command.busy === "library.export", onClick: exportOne }, "\u5BFC\u51FA Markdown"),
      h(Button, { tone: "danger", onClick: () => setConfirming(true) }, "\u5220\u9664")
    ),
    downloads.length ? h("div", { className: "di-notice" }, downloads.map((file) => h("a", { className: "di-link", href: interviewApi.downloadUrl(file.token), key: file.token }, `\u4E0B\u8F7D ${file.name}`))) : null,
    confirming ? h(
      "div",
      { className: "di-modal-backdrop" },
      h(
        "div",
        { className: "di-confirm-modal", role: "alertdialog", "aria-label": "\u786E\u8BA4\u5220\u9664\u7EC3\u4E60" },
        h(
          "div",
          { className: "di-confirm-copy" },
          h("span", { className: "di-confirm-icon", "aria-hidden": "true" }, h(Icon, { name: "alert", size: 17 })),
          h("div", null, h("h4", null, "\u786E\u8BA4\u5220\u9664\u8BE5\u7EC3\u4E60\uFF1F"), h("p", null, "\u786E\u8BA4\u5220\u9664\u8BE5\u7EC3\u4E60\u53CA\u5168\u90E8\u4F5C\u7B54\u8BB0\u5F55\u5417\uFF1F\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002"))
        ),
        h(
          "div",
          { className: "di-actions" },
          h(Button, { onClick: () => setConfirming(false) }, "\u53D6\u6D88"),
          h(Button, { tone: "danger", busy: command.busy === "library.delete", onClick: remove }, "\u786E\u8BA4\u5220\u9664")
        )
      )
    ) : null,
    editing ? h(PracticeConfigForm, { key: practice.id, initial: practice, busy: command.busy === "practice.update", onSubmit: updateConfiguration, onCancel: () => setEditing(false) }) : null,
    !editing ? h(PracticeDocumentSources, { config: practice.config }) : null,
    h(ErrorNotice, null, command.error),
    practice.mode === "leetcode" && practice.status === "active" ? h(LeetcodeTrainingControls, {
      key: `${practice.id}:${practice.config.category || ""}:${(practice.config.difficulties || []).join(",")}`,
      practice,
      sessionId,
      busy: advancingMode,
      onNext: nextLeetcode
    }) : null,
    practice.summary?.kind === "leetcode" ? h(
      "section",
      { className: "di-section" },
      h("div", { className: "di-section-label" }, "\u5237\u9898\u6C47\u603B"),
      h("div", { className: "di-meta" }, `\u672C\u6B21\u5171\u8BB0\u5F55 ${practice.summary.questionCount} \u9053\u9898\uFF0C\u8BE6\u7EC6\u9898\u76EE\u89C1\u4E0B\u65B9\u3002`)
    ) : practice.summary ? h(
      "section",
      { className: "di-section" },
      h("div", { className: "di-section-label" }, "\u7EC3\u4E60\u603B\u7ED3"),
      h(Markdown, null, practice.summary.overall),
      h(
        "div",
        { className: "di-attempt" },
        h("div", null, "\u8868\u73B0\u4EAE\u70B9"),
        h("ul", null, practice.summary.strengths.map((item) => h("li", { key: item }, item))),
        h("div", null, "\u6539\u8FDB\u5EFA\u8BAE"),
        h("ul", null, practice.summary.improvements.map((item) => h("li", { key: item }, item)))
      )
    ) : null,
    practice.questions.length ? practice.questions.map((question) => {
      const latest = question.attempts.at(-1);
      const fixedProblem = question.leetcode || question.hot100;
      return h(
        "article",
        { className: "di-detail-question", key: question.id },
        h(
          "div",
          { className: "di-detail-question-head" },
          h("span", { className: "di-sequence" }, `Q${String(question.sequence).padStart(2, "0")}`),
          h("div", { className: "di-detail-question-text" }, editingQuestionId === question.id ? h("input", { className: "di-input", value: questionDraft, onChange: (event) => setQuestionDraft(event.target.value) }) : h(Markdown, null, question.prompt)),
          fixedProblem ? h("a", { className: "di-link di-problem-tags", href: fixedProblem.url, target: "_blank", rel: "noreferrer" }, fixedProblem.category, h(DifficultyBadge, { difficulty: fixedProblem.difficulty, custom: fixedProblem.custom })) : h(ScoreRail, { score: question.latestScore, compact: true })
        ),
        fixedProblem ? h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: practice.id, question }) : null,
        question.attempts.map((attempt) => h(
          "div",
          { className: "di-attempt", key: attempt.id },
          h("div", { className: "di-attempt-head" }, h("span", null, `\u7B2C ${attempt.sequence} \u6B21\u4F5C\u7B54`), h("span", null, attempt.evaluation ? `${attempt.evaluation.score}/10` : "\u672A\u8BC4\u4EF7")),
          h(Markdown, null, attempt.answer),
          attempt.evaluation ? h("div", { className: "di-section" }, h(Markdown, null, attempt.evaluation.feedback)) : null
        )),
        question.capabilities?.allowReveal !== false ? h(QuestionSolutionPanel, {
          key: `solution:${question.id}`,
          sessionId,
          practiceId: practice.id,
          question,
          canGenerate: practice.status === "active"
        }) : null,
        codeContext?.practiceId === practice.id && codeContext.questionId === question.id ? h(CodeAnswerEditor, {
          key: codeContext.presentationId,
          sessionId,
          question,
          artifact: codeContext,
          language: practice.mode === "leetcode" ? practice.config.language : ""
        }) : null,
        h(
          "div",
          { className: "di-detail-actions" },
          practice.status === "active" ? h(
            Button,
            { disabled: !sessionId, title: sessionId ? void 0 : "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD", busy: command.busy === "question.code-open", onClick: () => openCode(question.id) },
            h(Icon, { name: "code" }),
            codeContext?.questionId === question.id ? "\u7EE7\u7EED\u5199\u4EE3\u7801" : "\u5199\u4EE3\u7801"
          ) : null,
          !fixedProblem && editingQuestionId === question.id ? h(
            import_react14.default.Fragment,
            null,
            h(Button, { tone: "primary", disabled: !questionDraft.trim(), busy: command.busy === "question.update", onClick: () => updateQuestion(question.id) }, "\u4FDD\u5B58\u9898\u76EE"),
            h(Button, { onClick: () => {
              setEditingQuestionId(null);
              setQuestionDraft("");
            } }, "\u53D6\u6D88")
          ) : !fixedProblem ? h(Button, { onClick: () => {
            setEditingQuestionId(question.id);
            setQuestionDraft(question.prompt);
          } }, "\u7F16\u8F91\u9898\u76EE") : null,
          !question.leetcode && practice.status === "active" && latest?.evaluation ? h(Button, { onClick: () => retry(question.id) }, "\u91CD\u65B0\u4F5C\u7B54") : null,
          h(Button, { tone: "danger", onClick: () => setDeletingQuestionId(question.id) }, "\u5220\u9664\u9898\u76EE")
        ),
        deletingQuestionId === question.id ? h(
          "div",
          { className: "di-confirm" },
          h("div", null, "\u786E\u8BA4\u5220\u9664\u8BE5\u9898\u53CA\u5176\u5168\u90E8\u4F5C\u7B54\u3001\u8BC4\u4EF7\u548C\u8BB2\u89E3\uFF1F"),
          h(
            "div",
            { className: "di-actions" },
            h(Button, { onClick: () => setDeletingQuestionId(null) }, "\u53D6\u6D88"),
            h(Button, { tone: "danger", busy: command.busy === "question.delete", onClick: () => deleteQuestion(question.id) }, "\u786E\u8BA4\u5220\u9664")
          )
        ) : null
      );
    }) : h(Empty, { title: "\u8FD9\u6761\u7EC3\u4E60\u8FD8\u6CA1\u6709\u9898\u76EE" })
  );
}
function PracticeLibrary({
  sessionId,
  initialPracticeId = null,
  statusScope = "completed",
  title = "\u7EC3\u4E60\u6863\u6848",
  allowCreate = false
}) {
  const [queryText, setQueryText] = import_react14.default.useState("");
  const [mode, setMode] = import_react14.default.useState("");
  const [selectedId, setSelectedId] = import_react14.default.useState(initialPracticeId);
  const [confirmingId, setConfirmingId] = import_react14.default.useState(null);
  const [downloads, setDownloads] = import_react14.default.useState([]);
  const [creating, setCreating] = import_react14.default.useState(false);
  const [advancedSession, setAdvancedSession] = import_react14.default.useState(null);
  const command = useCommand(sessionId);
  const effectiveStatus = statusScope === "active" ? "active" : "completed";
  const normalizedQuery = queryText.trim();
  const modeFilter = PRACTICE_MODE_OPTIONS.some((option) => option.value === mode) ? mode : void 0;
  const filters = { query: normalizedQuery || void 0, mode: modeFilter, status: effectiveStatus };
  const list = useInterviewQuery(
    `practices:${normalizedQuery}:${modeFilter || "all"}:${effectiveStatus}`,
    () => interviewApi.practices(filters),
    [normalizedQuery, modeFilter, effectiveStatus],
    { cache: false }
  );
  const practices = list.data?.resource?.data || [];
  const advancedPractice = advancedSession?.session?.practice;
  const advancePending = advancedPractice?.id === selectedId && advancedPractice.status === effectiveStatus && (!modeFilter || advancedPractice.mode === modeFilter);
  const visibleSelectedId = practices.some((practice) => practice.id === selectedId) || advancePending ? selectedId : null;
  const detail = useInterviewQuery(
    `practice:${visibleSelectedId || "none"}`,
    () => visibleSelectedId ? interviewApi.practice(visibleSelectedId) : Promise.resolve(null),
    [visibleSelectedId],
    { cache: false }
  );
  const savedDetail = detail.data?.resource?.data;
  const selected = savedDetail?.id === visibleSelectedId ? savedDetail : advancePending ? advancedPractice : null;
  const advanced = (session) => {
    setAdvancedSession({ session, codeContext: { practiceId: session.practice.id, questionId: session.currentQuestionId, sessionRevision: session.revision, presentationId: `workspace-code:${session.revision}:${Date.now()}` } });
    setSelectedId(session.practice.id);
  };
  const run = (name2, payload) => command.run(name2, payload).catch(() => null);
  const createPractice = async (payload) => {
    const result = await run("session.start", payload);
    if (!result) return;
    setCreating(false);
    setSelectedId(result.resource?.data?.practice?.id || result.resource?.data?.id || null);
    interviewApi.navigateWorkspace("active");
  };
  const activate = async (practice) => {
    const result = await run(practice.status === "completed" ? "session.reopen" : "session.select", { practiceId: practice.id });
    if (result) interviewApi.navigateWorkspace("active");
  };
  const exportOne = async (practice) => {
    const result = await run("library.export", { practiceIds: [practice.id] });
    if (result) setDownloads(result.resource.data || []);
  };
  const remove = async (practice) => {
    if (!practice) return;
    const result = await run("library.delete", { practiceId: practice.id });
    if (!result) return;
    if (selectedId === practice.id) setSelectedId(null);
    setConfirmingId(null);
    interviewApi.invalidate();
  };
  const dateText = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "\u2014" : date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replaceAll("/", "-");
  };
  const scoreClass = (score) => Number(score) >= 8 ? "is-good" : Number(score) >= 6 ? "is-mid" : "is-empty";
  const emptyState = effectiveStatus === "active" ? { title: "\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u7EC3\u4E60", detail: "\u65B0\u5EFA\u7EC3\u4E60\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" } : { title: "\u7EC3\u4E60\u6863\u6848\u4E3A\u7A7A", detail: "\u7ED3\u675F\u7EC3\u4E60\u540E\u4F1A\u5F52\u6863\u5230\u8FD9\u91CC\u3002" };
  const rows = practices.map((practice) => h(
    "tr",
    { key: practice.id, className: visibleSelectedId === practice.id ? "is-selected" : "" },
    h("td", null, h("button", { className: "di-history-topic", onClick: () => setSelectedId(visibleSelectedId === practice.id ? null : practice.id) }, practice.topic)),
    h("td", null, h("span", { className: `di-mode-badge is-${practice.mode}` }, practice.modeLabel)),
    h("td", { className: "di-history-time" }, dateText(practice.updatedAt)),
    h("td", null, h("span", { className: `di-history-score ${scoreClass(practice.averageScore)}` }, practice.averageScore ?? "\u2014")),
    h("td", null, h(
      "div",
      { className: "di-row-actions" },
      h(Button, {
        className: "di-icon-button",
        title: practice.status === "completed" ? "\u91CD\u65B0\u6253\u5F00" : "\u5207\u6362\u5230\u8BE5\u7EC3\u4E60",
        "aria-label": practice.status === "completed" ? `\u91CD\u65B0\u6253\u5F00${practice.topic}` : `\u5207\u6362\u5230${practice.topic}`,
        onClick: () => activate(practice)
      }, h(Icon, { name: "swap" })),
      h(Button, { className: "di-icon-button is-delete", title: "\u5220\u9664", "aria-label": `\u5220\u9664${practice.topic}`, onClick: () => setConfirmingId(practice.id) }, h(Icon, { name: "trash" })),
      h(Button, { className: "di-icon-button", title: "\u5BFC\u51FA", "aria-label": `\u5BFC\u51FA${practice.topic}`, onClick: () => exportOne(practice) }, h(Icon, { name: "download" }))
    ))
  ));
  return h(
    "section",
    { className: "di-ledger di-history", "aria-label": title },
    h(
      "header",
      { className: "di-history-head" },
      h("h2", { className: "di-ledger-title" }, title),
      allowCreate ? h(Button, { tone: "primary", onClick: () => setCreating((value) => !value) }, h(Icon, { name: "plus", size: 15 }), "\u65B0\u5EFA\u7EC3\u4E60") : null
    ),
    allowCreate && creating ? h(PracticeConfigForm, { busy: command.busy === "session.start", onSubmit: createPractice, onCancel: () => setCreating(false) }) : null,
    h(
      "div",
      { className: "di-history-filters" },
      h("input", { className: "di-input", value: queryText, onChange: (event) => setQueryText(event.target.value), placeholder: "\u641C\u7D22\u7EC3\u4E60\u4E3B\u9898", "aria-label": "\u641C\u7D22\u7EC3\u4E60\u4E3B\u9898" }),
      h(Select, { className: "di-history-mode-select", value: mode, options: [{ value: "", label: "\u5168\u90E8\u6A21\u5F0F" }, ...PRACTICE_MODE_OPTIONS], onChange: setMode, "aria-label": "\u7B5B\u9009\u6A21\u5F0F" })
    ),
    h(ErrorNotice, null, list.error),
    downloads.length ? h("div", { className: "di-notice" }, downloads.map((file) => h("a", { className: "di-link", href: interviewApi.downloadUrl(file.token), key: file.token }, `\u4E0B\u8F7D ${file.name}`))) : null,
    confirmingId ? h(
      "div",
      { className: "di-modal-backdrop" },
      h(
        "div",
        { className: "di-confirm-modal", role: "alertdialog", "aria-label": "\u786E\u8BA4\u5220\u9664\u7EC3\u4E60" },
        h(
          "div",
          { className: "di-confirm-copy" },
          h("span", { className: "di-confirm-icon", "aria-hidden": "true" }, h(Icon, { name: "alert", size: 17 })),
          h(
            "div",
            null,
            h("h4", null, "\u786E\u8BA4\u5220\u9664\u8BE5\u7EC3\u4E60\uFF1F"),
            h("p", null, `\u786E\u8BA4\u5220\u9664\u201C${practices.find((item) => item.id === confirmingId)?.topic || "\u8BE5\u7EC3\u4E60"}\u201D\u53CA\u5168\u90E8\u4F5C\u7B54\u8BB0\u5F55\u5417\uFF1F\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002`)
          )
        ),
        h(
          "div",
          { className: "di-actions" },
          h(Button, { onClick: () => setConfirmingId(null) }, "\u53D6\u6D88"),
          h(Button, { tone: "danger", busy: command.busy === "library.delete", onClick: () => remove(practices.find((item) => item.id === confirmingId)) }, "\u786E\u8BA4\u5220\u9664")
        )
      )
    ) : null,
    list.loading && !list.data ? h(Loading) : practices.length ? h(
      "div",
      { className: "di-history-scroll" },
      h(
        "table",
        { className: "di-history-table" },
        h("thead", null, h(
          "tr",
          null,
          h("th", null, "\u7EC3\u4E60\u5185\u5BB9"),
          h("th", null, "\u7C7B\u578B"),
          h("th", null, "\u7EC3\u4E60\u65F6\u95F4"),
          h("th", null, "\u5F97\u5206"),
          h("th", { "aria-label": "\u64CD\u4F5C" })
        )),
        h("tbody", null, rows)
      )
    ) : h(
      "div",
      { className: "di-history-empty" },
      h("span", { className: "di-history-empty-icon", "aria-hidden": "true" }, h(Icon, { name: "archive", size: 24 })),
      h("div", { className: "di-history-empty-title" }, emptyState.title),
      h("span", null, emptyState.detail)
    ),
    visibleSelectedId ? h(
      "div",
      { className: "di-history-detail" },
      !selected ? h(Loading, { label: "\u6B63\u5728\u8BFB\u53D6\u7EC3\u4E60\u8BE6\u60C5\u2026" }) : h(PracticeDetail, {
        key: selected.id,
        practice: selected,
        sessionId,
        onAdvanced: advanced,
        initialCodeContext: advancedSession?.codeContext?.practiceId === selected.id ? advancedSession.codeContext : null,
        onDeleted: () => {
          setSelectedId(null);
          interviewApi.invalidate();
        }
      })
    ) : null
  );
}
function InsightsCard() {
  const query = useInterviewQuery("insights", () => interviewApi.insights(), [], { cache: false });
  if (query.loading && !query.data) return h("div", { className: "di-card" }, h(Loading));
  if (query.error) return h("div", { className: "di-card" }, h(ErrorNotice, null, query.error));
  const insight = query.data?.resource?.data;
  return h(
    "article",
    { className: "di-card" },
    h("header", { className: "di-card-head" }, h("div", { className: "di-title" }, "\u80FD\u529B\u590D\u76D8")),
    h(
      "div",
      { className: "di-card-body" },
      h("div", { className: "di-score-row" }, h("span", { className: "di-score-number" }, insight.averageScore ?? "\u2014"), h(ScoreRail, { score: insight.averageScore })),
      h("div", { className: "di-meta", style: { marginTop: "8px" } }, `${insight.practiceCount} \u6B21\u7EC3\u4E60 \xB7 ${insight.questionCount} \u9053\u9898 \xB7 ${insight.evaluatedCount} \u6B21\u8BC4\u4EF7`),
      insight.topics.length ? h(
        "div",
        { className: "di-section" },
        insight.topics.map((topic) => h("div", { className: "di-attempt-head", key: topic.topic }, h("span", null, `${topic.topic} \xB7 ${topic.evaluatedCount} \u9898`), h("span", { className: "di-score-row" }, h("span", null, topic.averageScore), h(ScoreRail, { score: topic.averageScore, compact: true }))))
      ) : h(Empty, { title: "\u5B8C\u6210\u8BC4\u4EF7\u540E\u751F\u6210\u80FD\u529B\u590D\u76D8" })
    )
  );
}

// src/client/features/timeline.js
var import_react15 = __toESM(require("react"), 1);
function timelineArtifact(practiceId, questionId, revision) {
  return { practiceId, questionId, sessionRevision: revision, presentationId: `timeline-code:${revision}:${Date.now()}` };
}
function TimelineAnswerEntry({ sessionId, session, practice, question }) {
  const command = useCommand(sessionId);
  const [artifact, setArtifact] = import_react15.default.useState(() => practice.status === "active" && session?.practice?.id === practice.id && session.currentQuestionId === question.id ? timelineArtifact(practice.id, question.id, session.revision) : null);
  const openCode = async () => {
    try {
      const result = await command.run("question.code-open", { practiceId: practice.id, questionId: question.id });
      const session2 = result.resource?.data;
      if (session2?.practice?.id !== practice.id || session2.currentQuestionId !== question.id) return;
      setArtifact(timelineArtifact(practice.id, question.id, session2.revision));
    } catch {
    }
  };
  return h(
    "section",
    { className: "di-time-answer-entry", "aria-label": "\u672C\u9898\u4F5C\u7B54" },
    practice.status === "active" ? h(
      import_react15.default.Fragment,
      null,
      !artifact || question.attempts.length ? h(
        Button,
        { tone: "primary", disabled: !sessionId || Boolean(command.busy), busy: command.busy === "question.code-open", onClick: openCode },
        h(Icon, { name: "code" }),
        artifact ? "\u91CD\u65B0\u5199\u4EE3\u7801" : question.attempts.length ? "\u518D\u6B21\u4F5C\u7B54" : "\u5199\u4EE3\u7801\u4F5C\u7B54"
      ) : null,
      !artifact || practice.mode !== "leetcode" ? h("p", { className: "di-meta" }, "\u5728\u8FD9\u91CC\u5199\u4EE3\u7801\u5E76\u63D0\u4EA4 AI \u5206\u6790\uFF1B\u6587\u5B57\u56DE\u7B54\u4E5F\u53EF\u76F4\u63A5\u53D1\u9001\u5230\u5BF9\u8BDD\u3002") : null
    ) : h("p", { className: "di-meta" }, "\u7EC3\u4E60\u5DF2\u7ED3\u675F\uFF0C\u91CD\u65B0\u6253\u5F00\u540E\u53EF\u4EE5\u7EE7\u7EED\u4F5C\u7B54\u3002"),
    artifact && practice.status === "active" ? h(CodeAnswerEditor, {
      key: artifact.presentationId,
      sessionId,
      question,
      artifact,
      language: practice.mode === "leetcode" ? practice.config.language : ""
    }) : null,
    h(ErrorNotice, null, command.error)
  );
}
function TimelineContent({ question, sessionId, session, practice }) {
  const prompt = question.leetcode || question.hot100 ? h(
    "div",
    { className: "di-time-lc-question" },
    h("a", { className: "di-link", href: (question.leetcode || question.hot100).url, target: "_blank", rel: "noreferrer" }, question.prompt, " \u2197"),
    h("div", { className: "di-meta di-problem-tags" }, (question.leetcode || question.hot100).category, h(DifficultyBadge, { difficulty: (question.leetcode || question.hot100).difficulty })),
    h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: practice.id, question })
  ) : h(Markdown, null, question.prompt);
  return h(
    "div",
    { className: "di-time-unified" },
    h("section", { "aria-label": "\u9898\u76EE" }, prompt),
    h(
      "section",
      { "aria-label": "\u4F5C\u7B54\u4E0E\u8BB0\u5F55" },
      h("h4", null, "\u4F5C\u7B54"),
      h(TimelineAnswerEntry, { key: question.id, sessionId, session, practice, question }),
      !question.attempts.length ? null : h("div", { className: "di-time-records" }, question.attempts.map((attempt) => h(
        "section",
        { className: "di-time-record", key: attempt.id },
        h(
          "div",
          { className: "di-time-record-label" },
          h("span", null, `\u7B2C ${attempt.sequence} \u6B21\u56DE\u7B54`),
          h("span", null, attempt.evaluation ? `${attempt.evaluation.score}/10` : "\u5F85\u70B9\u8BC4")
        ),
        h(
          "div",
          { className: "di-time-record-answer" },
          h("div", { className: "di-time-content-label" }, "\u56DE\u7B54"),
          h(Markdown, null, attempt.answer)
        ),
        attempt.evaluation ? h(
          "div",
          { className: "di-time-record-review" },
          h("div", { className: "di-time-content-label" }, "\u70B9\u8BC4"),
          h(Markdown, null, attempt.evaluation.feedback)
        ) : null
      )))
    ),
    question.capabilities?.allowReveal !== false ? h(QuestionSolutionPanel, { key: `solution:${question.id}`, sessionId, practiceId: practice.id, question, canGenerate: practice.status === "active" }) : null
  );
}
function TimelinePanel({ sessionId, revisionSignal }) {
  const [selection, setSelection] = import_react15.default.useState(null);
  const sessionQuery = useInterviewQuery(`timeline-session:${sessionId}:${revisionSignal}`, () => interviewApi.session(sessionId), [sessionId, revisionSignal], { cache: false });
  const session = sessionQuery.data?.resource?.data;
  const practiceId = session?.practice?.id || null;
  const detailQuery = useInterviewQuery(`timeline-practice:${practiceId || "none"}:${revisionSignal}`, () => practiceId ? interviewApi.practice(practiceId) : Promise.resolve(null), [practiceId, revisionSignal], { cache: false });
  const practice = detailQuery.data?.resource?.data;
  if (!session?.selected || !practice?.questions?.length) return null;
  const selectedQuestion = practice.questions.find((question) => question.id === selection?.questionId);
  return h(
    "nav",
    {
      className: "di-timeline",
      "aria-label": "\u9898\u76EE\u65F6\u95F4\u8F74",
      onKeyDown: (event) => {
        if (event.key === "Escape") setSelection(null);
      }
    },
    h("div", { className: "di-time-list" }, practice.questions.map((question) => {
      const active = selection?.questionId === question.id;
      return h("div", {
        className: `di-time-item${session.currentQuestionId === question.id ? " is-current" : ""}${active ? " has-view" : ""}`,
        key: question.id
      }, h(
        "button",
        {
          className: "di-time-node",
          type: "button",
          "aria-label": `\u7B2C ${question.sequence} \u9898\uFF1A${question.prompt}`,
          onClick: () => setSelection({ questionId: question.id })
        },
        h("span", { className: "di-time-dot", "aria-hidden": "true" }),
        h("span", null, `Q${String(question.sequence).padStart(2, "0")}`)
      ));
    })),
    selectedQuestion ? h(
      "section",
      { className: "di-time-flyout", "aria-label": "\u9898\u76EE\u3001\u4F5C\u7B54\u4E0E\u7B54\u6848" },
      h(
        "header",
        { className: "di-time-flyout-head" },
        h("h3", { className: "di-time-title" }, `Q${String(selectedQuestion.sequence).padStart(2, "0")} \xB7 ${selectedQuestion.prompt}`),
        h("button", { type: "button", onClick: () => setSelection(null), "aria-label": "\u5173\u95ED" }, "\xD7")
      ),
      h("div", { className: "di-time-flyout-body" }, h(TimelineContent, { question: selectedQuestion, sessionId, session, practice }))
    ) : null
  );
}

// src/client/features/workspace-dock.js
var import_react16 = __toESM(require("react"), 1);

// src/client/shared/current-session.js
function currentInterviewSession(state) {
  if (typeof state?.current === "string" && state.current) return state.current;
  const selected = Object.values(state?.byId || {}).filter((session) => session?.retainedBy?.mainView > 0);
  return selected.length === 1 ? selected[0].id : void 0;
}

// src/client/features/workspace-dock.js
var WORKSPACE_TABS = Object.freeze([
  { id: "active", label: "\u8FDB\u884C\u4E2D", icon: "clock" },
  { id: "library", label: "\u7EC3\u4E60\u6863\u6848", icon: "archive" },
  { id: "leetcode", label: "\u9898\u5E93", icon: "flame" }
]);
function WorkspaceContent({ tab, sessionId, practiceId }) {
  if (tab === "active") return h(PracticeLibrary, {
    sessionId,
    initialPracticeId: practiceId,
    statusScope: "active",
    title: "\u8FDB\u884C\u4E2D",
    allowCreate: true
  });
  if (tab === "library") return h(PracticeLibrary, {
    sessionId,
    statusScope: "completed",
    title: "\u7EC3\u4E60\u6863\u6848",
    allowCreate: false
  });
  if (tab === "leetcode") return h(LeetcodeCatalog, { sessionId });
  return null;
}
function WorkspaceSidebarEntry({ wide = true, useSessions }) {
  const sessionId = useSessions(currentInterviewSession);
  return h(WorkspaceDock, { sessionId, wide });
}
function WorkspaceDock({ sessionId, wide = true }) {
  const [open, setOpen] = import_react16.default.useState(false);
  const [tab, setTab] = import_react16.default.useState("active");
  const [notice, setNotice] = import_react16.default.useState("");
  const [practiceId, setPracticeId] = import_react16.default.useState(null);
  const closeButtonRef = import_react16.default.useRef(null);
  const activeQuery = useInterviewQuery(
    `workspace-active-count:${open}`,
    () => interviewApi.practices({ status: "active" }),
    [open],
    { cache: false }
  );
  const activeCount = activeQuery.data?.resource?.data?.length || 0;
  import_react16.default.useEffect(() => {
    let timer = null;
    const unsubscribe = interviewApi.subscribeNotifications((message) => {
      if (timer) clearTimeout(timer);
      setNotice(message);
      timer = setTimeout(() => setNotice(""), 2600);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  import_react16.default.useEffect(() => interviewApi.subscribeWorkspaceNavigation((nextTab, context) => {
    if (WORKSPACE_TABS.some((item) => item.id === nextTab)) setTab(nextTab);
    setPracticeId(context?.practiceId || null);
    setOpen(true);
  }), []);
  import_react16.default.useEffect(() => {
    if (!open) return void 0;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return h(
    import_react16.default.Fragment,
    null,
    h(
      "button",
      {
        type: "button",
        className: `di-workspace-entry${wide ? "" : " is-rail"}${open ? " is-open" : ""}`,
        title: wide ? void 0 : "\u9762\u8BD5\u8BAD\u7EC3",
        "aria-label": "\u9762\u8BD5\u8BAD\u7EC3",
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": "di-interview-workspace",
        onClick: () => setOpen(true)
      },
      h(Icon, { name: "grid", size: wide ? 16 : 18 }),
      wide ? h("span", { className: "di-workspace-entry-label" }, "\u9762\u8BD5\u8BAD\u7EC3") : null,
      wide && activeCount > 0 ? h("span", { className: "di-workspace-entry-count" }, activeCount) : null
    ),
    open ? h(
      "div",
      {
        className: "di-workspace-backdrop",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }
      },
      h(
        "section",
        {
          id: "di-interview-workspace",
          className: "di-workspace-panel",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "\u7EC3\u4E60\u5DE5\u4F5C\u53F0"
        },
        h(
          "header",
          { className: "di-workspace-head" },
          h(
            "div",
            { className: "di-workspace-brand" },
            h("span", { className: "di-workspace-brand-icon", "aria-hidden": "true" }, h(Icon, { name: "grid", size: 18 })),
            h("h2", null, "\u7EC3\u4E60\u5DE5\u4F5C\u53F0")
          ),
          h("button", { ref: closeButtonRef, type: "button", onClick: () => setOpen(false), "aria-label": "\u5173\u95ED\u7EC3\u4E60\u5DE5\u4F5C\u53F0" }, h(Icon, { name: "close", size: 20 }))
        ),
        h(
          "div",
          { className: "di-workspace-layout" },
          h("nav", { className: "di-workspace-tabs", "aria-label": "\u5DE5\u4F5C\u53F0\u89C6\u56FE" }, WORKSPACE_TABS.map((item) => h(
            "button",
            {
              type: "button",
              key: item.id,
              className: tab === item.id ? "is-active" : "",
              "aria-current": tab === item.id ? "page" : void 0,
              onClick: () => setTab(item.id)
            },
            h(Icon, { name: item.icon, size: 16 }),
            h("span", null, item.label),
            item.id === "active" && activeCount > 0 ? h("span", { className: "di-workspace-count" }, activeCount) : null
          ))),
          h("main", { className: `di-workspace-content is-${tab}` }, h(WorkspaceContent, { tab, sessionId, practiceId }))
        )
      )
    ) : null,
    notice ? h("div", { className: "di-local-toast", role: "status" }, notice) : null
  );
}

// src/protocol/interview-tool-names.js
var INTERVIEW_TOOL_NAMES = Object.freeze([
  "interview_session",
  "interview_practice",
  "interview_question",
  "interview_attempt",
  "interview_evaluation",
  "interview_explanation",
  "interview_leetcode",
  "interview_materials",
  "interview_notes",
  "interview_show_practice_setup",
  "interview_show_question",
  "interview_show_review",
  "interview_show_summary",
  "interview_show_practice",
  "interview_show_practice_list",
  "interview_show_insights",
  "interview_show_leetcode_catalog"
]);

// src/client/shared/styles.js
var STYLE_TEXT = `
body{--di-weight-text:400;--di-weight-title:600}
body{--di-ink:#0f172a;--di-ink-2:#334155;--di-ink-3:#475569;--di-muted:#64748b;--di-faint:#94a3b8;--di-surface:#fff;--di-surface-2:#fbfcfe;--di-surface-3:#f8fafc;--di-sunken:#f1f5f9;--di-field:#fff;--di-paper:#f7f9fc;--di-veil:rgba(248,250,252,.7);--di-veil-strong:rgba(255,255,255,.85);--di-line:#f1f5f9;--di-line-2:#e5eaf1;--di-line-3:#e2e8f0;--di-line-4:#cbd5e1;--di-line-5:#b9c2d2;--di-accent:#2563eb;--di-accent-strong:#245cff;--di-accent-soft:#eff6ff;--di-accent-tint:rgba(37,99,235,.1);--di-accent-line:#c7d7ff;--di-accent-badge:#eef2ff;--di-accent-badge-ink:#4338ca;--di-success:#15803d;--di-success-soft:#edf9f3;--di-success-line:#cfe5d8;--di-success-ink:#087a45;--di-success-bright:#10b981;--di-warn:#a86300;--di-warn-soft:#fff7e7;--di-warn-line:#f0dcb8;--di-warn-ink:#c2410c;--di-warn-bright:#ffb800;--di-warn-mid:#e69600;--di-danger:#e11d48;--di-danger-soft:#fff1f2;--di-danger-line:#ffd8dc;--di-danger-ink:#cf3139;--di-danger-deep:#b91c1c;--di-on-accent:#fff;--di-on-success:#fff;--di-accent-ink:#1e40af;--di-shadow:0 8px 28px rgba(28,39,67,.07);--di-shadow-soft:0 1px 2px rgba(15,23,42,.04);--di-shadow-panel:0 24px 70px rgba(18,28,52,.2);--di-shadow-pop:0 16px 42px rgba(23,32,51,.14);--di-shadow-modal:0 25px 50px -12px rgba(15,23,42,.3);--di-shadow-card:0 20px 25px -5px rgba(148,163,184,.18),0 8px 10px -6px rgba(148,163,184,.16);--di-shadow-accent:0 1px 2px rgba(37,99,235,.18);--di-backdrop:rgba(241,245,249,.82);--di-backdrop-2:rgba(15,23,42,.3);--di-focus:rgba(36,92,255,.18);--di-danger-focus:rgba(239,68,68,.2);--di-blue:var(--di-accent-strong);--di-blue-soft:var(--di-accent-soft);--di-green:var(--di-success);--di-green-soft:var(--di-success-soft);--di-amber:var(--di-warn-bright);--di-red:var(--di-danger);--di-white:var(--di-surface);}
body[data-ds-dark-theme]{--di-ink:var(--dsw-alias-label-primary,#f2f3f5);--di-ink-2:#d5d8dd;--di-ink-3:#c3c7ce;--di-muted:var(--dsw-alias-label-secondary,#a6abb3);--di-faint:var(--dsw-alias-label-tertiary,#8b9098);--di-surface:var(--dsw-alias-bg-layer-1,#232324);--di-surface-2:var(--dsw-alias-bg-layer-2,#2b2b2d);--di-surface-3:#2f2f32;--di-sunken:#353538;--di-field:#2f2f32;--di-paper:var(--dsw-alias-bg-base,#151517);--di-veil:rgba(255,255,255,.035);--di-veil-strong:rgba(35,35,37,.9);--di-line:var(--dsw-alias-border-l1,#ffffff14);--di-line-2:var(--dsw-alias-border-l2,#ffffff1f);--di-line-3:var(--dsw-alias-border-l3,#ffffff29);--di-line-4:var(--dsw-alias-border-l4,#ffffff33);--di-line-5:#5b5b60;--di-accent:var(--dsw-alias-link,#7ea6ff);--di-accent-strong:#3f6fe0;--di-accent-soft:#20293c;--di-accent-tint:rgba(126,166,255,.14);--di-accent-line:#3b4a6b;--di-accent-badge:#242c42;--di-accent-badge-ink:#aebfff;--di-success:var(--dsw-alias-state-success-primary,#5ed39b);--di-success-soft:var(--dsw-alias-state-success-tertiary,#16281f);--di-success-line:#2f4a3c;--di-success-ink:#6fdcab;--di-success-bright:#3fbf85;--di-warn:var(--dsw-alias-state-warn-label,#f0b354);--di-warn-soft:var(--dsw-alias-state-warn-tertiary,#2b2418);--di-warn-line:#4d3f22;--di-warn-ink:#f2c078;--di-warn-bright:#f0b354;--di-warn-mid:#e0ac5a;--di-danger:var(--dsw-alias-state-error-primary,#ff7b8a);--di-danger-soft:#2e1a1e;--di-danger-line:#5a2a31;--di-danger-ink:#ff9aa5;--di-danger-deep:#ff8a95;--di-on-accent:#fff;--di-on-success:#0c1f16;--di-accent-ink:#b7ccff;--di-shadow:0 8px 28px rgba(0,0,0,.42);--di-shadow-soft:0 1px 2px rgba(0,0,0,.32);--di-shadow-panel:0 24px 70px rgba(0,0,0,.55);--di-shadow-pop:0 16px 42px rgba(0,0,0,.5);--di-shadow-modal:0 25px 50px -12px rgba(0,0,0,.62);--di-shadow-card:0 18px 40px rgba(0,0,0,.45);--di-shadow-accent:0 1px 2px rgba(0,0,0,.5);--di-backdrop:rgba(8,8,10,.74);--di-backdrop-2:rgba(0,0,0,.55);--di-focus:rgba(126,166,255,.34);--di-danger-focus:rgba(255,123,138,.3);--di-blue:var(--di-accent-strong);--di-blue-soft:var(--di-accent-soft);--di-green:var(--di-success);--di-green-soft:var(--di-success-soft);--di-amber:var(--di-warn-bright);--di-red:var(--di-danger);--di-white:var(--di-surface);}

.di-workspace-entry{appearance:none;box-sizing:border-box;display:flex;flex:none;align-items:center;gap:8px;width:calc(100% + 8px);height:34px;margin:4px -4px;padding:6px 10px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,var(--di-ink));font:400 14px/22px "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;overflow:hidden}.di-workspace-entry:hover{background:var(--dsw-alias-interactive-bg-hover,var(--di-paper))}.di-workspace-entry.is-open{background:var(--dsw-specific-sidebar-nav-item-active,var(--di-blue-soft));color:var(--dsw-alias-label-primary,var(--di-blue))}.di-workspace-entry.is-rail{justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 4px;padding:0;border-radius:50%}.di-workspace-entry-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.di-workspace-entry-count{min-width:18px;margin-left:auto;padding:1px 5px;border-radius:999px;background:var(--dsw-alias-interactive-bg-selected,var(--di-blue-soft));color:var(--dsw-alias-label-secondary,var(--di-muted));font-size:10px;line-height:16px;text-align:center}.di-workspace-entry:focus-visible,.di-workspace-tabs button:focus-visible,.di-workspace-head>button:focus-visible{outline:3px solid var(--di-focus);outline-offset:2px}
.di-card,.di-ledger,.di-timeline,.di-lc-catalog{font-family:"Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;color:var(--di-ink);box-sizing:border-box}
.di-card *,.di-ledger *,.di-timeline *,.di-lc-catalog *{box-sizing:border-box}.di-preline{white-space:pre-wrap;line-height:1.75}.di-icon{display:inline-block;flex:0 0 auto;vertical-align:middle}
.di-card{width:min(1080px,100%);border:1px solid var(--di-line);border-radius:14px;background:var(--di-white);overflow:hidden;box-shadow:var(--di-shadow)}
.di-card-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 24px;border-bottom:1px solid var(--di-line);background:var(--di-white)}
.di-card-body{padding:24px}.di-title{font-size:18px;font-weight:var(--di-weight-title)}.di-meta{font-size:12px;line-height:1.5;color:var(--di-muted)}.di-markdown strong,.di-markdown b,.di-markdown h1,.di-markdown h2,.di-markdown h3,.di-markdown h4,.di-markdown h5,.di-markdown h6{font-weight:inherit}
.di-setup-card{overflow:visible}.di-setup-card .di-card-head{border-radius:14px 14px 0 0}.di-setup-card .di-practice-form{margin:0;border:0;border-radius:0 0 14px 14px;padding:22px 24px;background:var(--di-white)}.di-setup-card>.di-notice{margin:0 24px 22px}.di-setup-card .di-actions{justify-content:flex-end;padding-top:2px}.di-setup-card .di-button.is-primary{min-width:104px}
.di-setup-card.is-complete{overflow:hidden;background:var(--di-surface-3);box-shadow:none}.di-setup-complete{display:flex;align-items:center;justify-content:flex-start;gap:12px;min-height:78px;padding:13px 20px;background:var(--di-surface-3)}.di-setup-complete-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:0 0 auto;border-radius:50%;background:var(--di-success-bright);color:var(--di-white)}.di-setup-complete-copy{display:grid;gap:2px;min-width:0}.di-setup-complete-copy .di-title{font-size:14px;line-height:1.25}.di-setup-complete-copy .di-meta{font-size:11px;line-height:1.3}.di-setup-card.is-complete>.di-notice{margin:0 20px 13px}
.di-config-progress{display:flex;align-items:center;grid-column:1/-1;gap:0;margin:0;padding:0;list-style:none;color:var(--di-muted);font-size:12px}.di-config-progress li{display:flex;align-items:center;gap:7px}.di-config-progress li+li::before{content:"";width:42px;height:1px;margin:0 10px;background:var(--di-line)}.di-config-progress li>span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--di-line);border-radius:50%;background:var(--di-white);font-size:11px}.di-config-progress li.is-current{color:var(--di-accent)}.di-config-progress li.is-current>span{border-color:var(--di-accent);background:var(--di-blue);color:var(--di-white)}.di-config-progress li.is-complete>span{border-color:var(--di-accent-line);color:var(--di-accent);background:var(--di-blue-soft)}.di-config-stage{animation:di-config-enter .18s ease-out}.di-mode-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.di-mode-option{appearance:none;min-height:62px;border:1px solid var(--di-line);border-radius:10px;background:var(--di-white);color:var(--di-ink);font:var(--di-weight-text) 14px/1.3 "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .15s ease}.di-mode-option:hover:not(:disabled),.di-mode-option:focus-visible{outline:0;border-color:var(--di-accent-line);background:var(--di-blue-soft);transform:translateY(-1px)}.di-mode-option:focus-visible{box-shadow:0 0 0 3px var(--di-focus)}.di-mode-option:disabled{opacity:.55;cursor:not-allowed}.di-config-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.di-config-mode{display:flex;align-items:center;gap:9px;grid-column:1/-1;padding-bottom:3px;color:var(--di-muted);font-size:12px}
.di-question-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:30px;padding:26px 34px}.di-question-main{min-width:0}.di-question-text{font-size:19px;font-weight:var(--di-weight-title);line-height:1.55;color:var(--di-ink)}.di-question-text p{margin:0}.di-answer-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-width:140px;padding:12px 18px!important;border-color:var(--di-accent)!important;color:var(--di-accent)!important;background:var(--di-white)!important;font-size:15px!important}
.di-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--di-line);border-radius:8px;padding:9px 13px;background:var(--di-white);color:var(--di-ink);font:var(--di-weight-text) 13px/1 "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.di-button:hover:not(:disabled){transform:translateY(-1px);border-color:var(--di-accent-line);box-shadow:0 4px 12px var(--di-accent-tint)}.di-button:focus-visible,.di-input:focus-visible,.di-custom-select-trigger:focus-visible,.di-history-topic:focus-visible{outline:3px solid var(--di-focus);outline-offset:2px}.di-button:disabled{opacity:.55;cursor:not-allowed}.di-button.is-primary{background:var(--di-blue);border-color:var(--di-accent);color:#fff}.di-button.is-danger{color:var(--di-red);border-color:var(--di-danger-line);background:var(--di-danger-soft)}
.di-review-card{display:flex;flex-direction:column}.di-review-score{display:flex;align-items:center;gap:18px;padding:20px 28px;border-bottom:1px solid var(--di-line);background:var(--di-surface-2)}.di-review-check{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9px;color:#fff;background:var(--di-green);box-shadow:0 0 0 7px var(--di-green-soft)}.di-review-score-summary{display:flex;align-items:baseline;gap:12px}.di-review-score-label{font-size:14px;font-weight:var(--di-weight-text)}.di-review-score-value{display:flex;align-items:baseline;gap:7px}.di-review-score-number{font-size:30px;font-weight:var(--di-weight-text);line-height:1;color:var(--di-green)}.di-review-score-value>span:last-child{font-size:15px;color:var(--di-muted)}.di-stars{display:flex;gap:4px;margin-left:auto}.di-star{font-size:23px;line-height:1;background:linear-gradient(90deg,var(--di-amber) var(--di-star-fill),var(--di-line-3) var(--di-star-fill));background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent}.di-review-content{min-width:0;padding:26px 28px}.di-review-section+.di-review-section{margin-top:20px}.di-review-section h3{margin:0 0 9px;font-size:15px;font-weight:var(--di-weight-text)}.di-feedback-banner{padding:12px 15px;border:1px solid var(--di-success-soft);border-radius:9px;background:var(--di-green-soft);font-size:14px;line-height:1.65}.di-dimensions{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}.di-dimensions>span{display:inline-flex;gap:8px;padding:6px 9px;border-radius:6px;background:var(--di-paper);font-size:12px;color:var(--di-muted)}.di-dimension-score{color:var(--di-ink)}.di-explanation-copy{font-size:14px;line-height:1.75}.di-explanation-copy p,.di-explanation-copy ul,.di-explanation-copy ol{margin-top:6px;margin-bottom:6px}.di-memorize-box{margin-top:18px;padding:14px 15px;border:1px solid var(--di-success-soft);border-radius:9px;background:linear-gradient(100deg,var(--di-success-soft),var(--di-success-soft))}.di-memorize-label{margin-bottom:5px;font-size:13px;font-weight:var(--di-weight-text);color:var(--di-success-ink)}.di-memorize-copy{font-size:14px;line-height:1.65}.di-review-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:15px;border-top:1px solid var(--di-line)}
.di-score-row{display:flex;align-items:center;gap:12px}.di-score-number{font-size:27px;font-weight:var(--di-weight-text)}.di-score-rail{display:inline-grid;grid-template-columns:repeat(10,8px);gap:3px}.di-score-rail i{display:block;height:15px;border-radius:2px;background:var(--di-line-3)}.di-score-rail.is-compact{grid-template-columns:repeat(10,5px);gap:2px}.di-score-rail.is-compact i{height:9px}.di-score-rail i.is-good{background:var(--di-green)}.di-score-rail i.is-mid{background:var(--di-amber)}.di-score-rail i.is-low{background:var(--di-red)}
.di-section{margin-top:16px;padding-top:14px;border-top:1px solid var(--di-line)}.di-section-label{margin-bottom:8px;font-size:12px;font-weight:var(--di-weight-text);color:var(--di-muted)}.di-attempt{margin-top:12px;padding:12px 14px;border-left:3px solid var(--di-blue);background:var(--di-paper);border-radius:0 7px 7px 0}.di-attempt-head{display:flex;justify-content:space-between;margin-bottom:7px;font-size:12px;color:var(--di-muted)}.di-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.di-state,.di-empty{padding:28px;text-align:center;color:var(--di-muted)}.di-empty{display:grid;gap:6px}.di-spinner{display:inline-block;width:14px;height:14px;margin-right:8px;border:2px solid var(--di-line);border-top-color:var(--di-accent);border-radius:50%;animation:di-spin .8s linear infinite}.di-notice{margin:12px 18px;padding:10px 12px;border-radius:7px;background:var(--di-blue-soft);font-size:13px}.di-notice.is-error{background:var(--di-danger-soft);color:var(--di-red)}.di-link{color:var(--di-accent);text-decoration:none}
.di-tool-error{display:flex;align-items:baseline;gap:8px;width:min(1080px,100%);padding:10px 13px;border-left:3px solid var(--di-red);border-radius:0 7px 7px 0;background:var(--di-danger-soft);color:var(--di-red);font:13px/1.5 "Segoe UI","Microsoft YaHei",sans-serif}.di-tool-error span{color:var(--di-muted)}
.di-ledger{width:min(1080px,100%);border:1px solid var(--di-line);border-radius:14px;background:var(--di-white);overflow:hidden;box-shadow:var(--di-shadow)}.di-history-head{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:20px 24px;border-bottom:1px solid var(--di-line)}.di-ledger-title{margin:0;font-size:18px;font-weight:var(--di-weight-title)}.di-history-filters{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid var(--di-line);background:var(--di-surface-2)}.di-input,.di-select{min-width:0;border:1px solid var(--di-line);border-radius:7px;padding:8px 10px;background:var(--di-white);color:var(--di-ink)}.di-input{flex:1}.di-textarea{min-height:150px;resize:vertical;line-height:1.6}.di-practice-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:18px 24px;border-bottom:1px solid var(--di-line);background:var(--di-surface-2)}.di-field{display:grid;gap:6px;font-size:13px;font-weight:var(--di-weight-text)}.di-field-wide{grid-column:1/-1}.di-history-scroll{overflow-x:auto}.di-history-table{width:100%;border-collapse:collapse;font-size:13px}.di-history-table th{padding:10px 24px;color:var(--di-muted);font-weight:var(--di-weight-text);text-align:left;background:var(--di-surface-2)}.di-history-table td{padding:10px 24px;border-top:1px solid var(--di-line);white-space:nowrap}.di-history-table tr.is-selected td{background:var(--di-blue-soft)}.di-history-topic{appearance:none;border:0;padding:0;background:transparent;color:var(--di-ink);font:inherit;font-size:13px;font-weight:var(--di-weight-text);line-height:1.4;cursor:pointer;text-align:left}.di-history-topic:hover{color:var(--di-accent)}.di-history-time{color:var(--di-muted)}.di-history-score{font-size:14px}.di-history-score.is-good{color:var(--di-green)}.di-history-score.is-mid{color:var(--di-warn-mid)}.di-history-score.is-empty{color:var(--di-muted)}.di-row-actions{display:flex;justify-content:flex-end;gap:10px}.di-icon-button{width:34px;height:32px;padding:0}.di-icon-button.is-delete{color:var(--di-red);border-color:var(--di-danger-line);background:var(--di-danger-soft)}.di-delete-confirm{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:12px 24px;padding:11px 13px;border:1px solid var(--di-danger-line);border-radius:8px;background:var(--di-danger-soft);font-size:13px}.di-delete-confirm .di-actions{margin:0}.di-history-detail{border-top:1px solid var(--di-line);background:var(--di-surface-2)}.di-detail{padding:22px 24px;max-height:620px;overflow:auto}.di-detail-heading{display:flex;align-items:baseline;justify-content:space-between;gap:18px}.di-detail-question{padding:15px 0;border-bottom:1px solid var(--di-line)}.di-detail-question-head{display:flex;gap:10px;align-items:flex-start}.di-detail-question-text{flex:1;line-height:1.6}.di-detail-actions{display:flex;gap:6px;margin-top:10px}.di-sequence{font-size:12px;font-weight:var(--di-weight-text);color:var(--di-accent)}.di-confirm{margin-top:10px;padding:10px;border:1px solid var(--di-danger-line);border-radius:7px}
.di-lc-problem-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;padding:25px 28px;overflow:visible}.di-lc-problem-card.is-history{box-shadow:none}.di-lc-problem-main{min-width:0}.di-lc-problem-title{display:flex;align-items:baseline;gap:11px;font-size:21px;font-weight:var(--di-weight-title);line-height:1.35}.di-lc-problem-title>span{font-size:13px;font-weight:var(--di-weight-text);color:var(--di-muted)}.di-lc-problem-meta{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:12px;color:var(--di-muted)}.di-lc-problem-meta .is-complete{color:var(--di-green);font-weight:var(--di-weight-text)}.di-lc-problem-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;max-width:510px}.di-lc-problem-actions>.di-button{text-decoration:none}.di-lc-difficulty{display:inline-flex;align-items:center;justify-content:center;min-width:42px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:var(--di-weight-text)}.di-lc-difficulty.is-easy{color:var(--di-success-ink);background:var(--di-success-soft)}.di-lc-difficulty.is-medium{color:var(--di-warn);background:var(--di-warn-soft)}.di-lc-difficulty.is-hard{color:var(--di-danger-ink);background:var(--di-danger-soft)}
.di-lc-catalog{width:min(1080px,100%);margin-top:12px;border:1px solid var(--di-line);border-radius:14px;background:var(--di-white);overflow:hidden;box-shadow:var(--di-shadow)}.di-lc-catalog-head{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 28px 18px}.di-lc-title{margin:0;font-size:24px;font-weight:var(--di-weight-title);line-height:1.15}.di-lc-catalog-summary{display:flex;align-items:center;gap:16px}.di-lc-source{color:var(--di-muted);font-size:12px;text-decoration:none}.di-lc-source:hover{color:var(--di-accent)}.di-lc-progress-copy{display:flex;align-items:baseline;gap:5px;color:var(--di-muted)}.di-lc-progress-value{font-size:26px;font-weight:var(--di-weight-text);color:var(--di-green)}.di-lc-progress{height:3px;margin:0 28px 6px;border-radius:99px;background:var(--di-sunken);overflow:hidden}.di-lc-progress>i{display:block;height:100%;border-radius:inherit;background:var(--di-green);transition:width .2s ease}.di-lc-groups{padding:4px 28px 28px}.di-lc-group{display:grid;grid-template-columns:132px minmax(0,1fr);padding:22px 0;border-top:1px solid var(--di-line)}.di-lc-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-right:24px}.di-lc-group-head h3{margin:0;font-size:14px;font-weight:var(--di-weight-text)}.di-lc-group-head span{color:var(--di-muted);font-size:11px;font-variant-numeric:tabular-nums}.di-lc-problems{min-width:0}.di-lc-row{display:grid;grid-template-columns:24px minmax(0,1fr) 52px;align-items:center;gap:10px;min-height:38px;padding:3px 4px;border-radius:7px}.di-lc-row:hover{background:var(--di-paper)}.di-lc-row.is-complete .di-lc-problem-link{color:var(--di-muted)}.di-lc-check{appearance:none;width:19px;height:19px;border:1.5px solid var(--di-line-5);border-radius:5px;background:var(--di-white);color:#fff;font:var(--di-weight-text) 12px/16px "Segoe UI",sans-serif;cursor:pointer}.di-lc-check:hover{border-color:var(--di-green)}.di-lc-check:focus-visible,.di-lc-problem-link:focus-visible,.di-lc-source:focus-visible{outline:3px solid var(--di-focus);outline-offset:2px}.di-lc-check.is-complete{border-color:var(--di-green);background:var(--di-green);color:var(--di-on-success)}.di-lc-check:disabled{opacity:.55;cursor:wait}.di-lc-problem-link{display:flex;align-items:baseline;gap:9px;min-width:0;color:var(--di-ink);font-size:13px;font-weight:var(--di-weight-text);text-decoration:none}.di-lc-problem-link:hover{color:var(--di-accent)}.di-lc-problem-id{width:30px;flex:0 0 auto;color:var(--di-muted);font-size:11px;font-variant-numeric:tabular-nums;text-align:right}.di-lc-open{opacity:0;color:var(--di-accent);transition:opacity .15s ease}.di-lc-row:hover .di-lc-open{opacity:1}
.di-workspace-panel,.di-local-toast{font-family:"Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;box-sizing:border-box}.di-workspace-panel{position:fixed;z-index:54;right:18px;bottom:68px;width:min(1120px,calc(100vw - 36px));height:min(760px,calc(100vh - 92px));border:1px solid var(--di-line);border-radius:15px;background:var(--di-surface-2);box-shadow:var(--di-shadow-panel);overflow:hidden;color:var(--di-ink)}.di-workspace-head{display:flex;align-items:center;justify-content:space-between;height:70px;padding:0 22px 0 25px;border-bottom:1px solid var(--di-line);background:var(--di-white)}.di-workspace-head h2{margin:0;font-size:19px;font-weight:var(--di-weight-title)}.di-workspace-head>button{appearance:none;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:var(--di-muted);font-size:24px;cursor:pointer}.di-workspace-head>button:hover{background:var(--di-paper);color:var(--di-ink)}.di-workspace-layout{display:grid;grid-template-columns:120px minmax(0,1fr);height:calc(100% - 70px)}.di-workspace-tabs{display:flex;flex-direction:column;padding:18px 0;border-right:1px solid var(--di-line);background:var(--di-surface-3)}.di-workspace-tabs button{appearance:none;position:relative;border:0;padding:12px 16px;background:transparent;color:var(--di-muted);font:var(--di-weight-text) 12px/1.2 "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;text-align:left;cursor:pointer}.di-workspace-tabs button::before{content:"";position:absolute;top:8px;bottom:8px;left:0;width:3px;border-radius:0 3px 3px 0;background:transparent}.di-workspace-tabs button:hover{color:var(--di-ink)}.di-workspace-tabs button.is-active{color:var(--di-accent);background:var(--di-white)}.di-workspace-tabs button.is-active::before{background:var(--di-blue)}.di-workspace-content{min-width:0;padding:18px;overflow:auto}.di-workspace-content>.di-card,.di-workspace-content>.di-ledger,.di-workspace-content>.di-lc-catalog{width:100%;margin-top:0;box-shadow:none}.di-local-toast{position:fixed;z-index:70;right:18px;bottom:76px;max-width:min(360px,calc(100vw - 36px));padding:11px 14px;border:1px solid var(--di-success-line);border-radius:9px;background:var(--di-success-soft);box-shadow:var(--di-shadow-pop);color:var(--di-success-ink);font-size:13px;font-weight:var(--di-weight-text)}
.di-timeline{position:fixed;right:10px;top:112px;z-index:40;width:64px;overflow:visible;font-family:"Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;color:var(--di-ink)}.di-time-list{display:grid;gap:14px;max-height:calc(100vh - 144px);padding:4px 8px 4px 0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;-ms-overflow-style:none}.di-time-list::-webkit-scrollbar{display:none}.di-time-item{position:relative;width:56px;min-height:34px}.di-time-item:not(:last-child)::after{content:"";position:absolute;z-index:-1;top:27px;right:43px;width:1px;height:25px;background:var(--di-line)}.di-time-node{appearance:none;display:flex;align-items:center;gap:7px;width:56px;height:30px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:var(--di-muted);font:var(--di-weight-text) 11px/1 "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;transition:color .15s ease,background .15s ease}.di-time-node:hover,.di-time-node:focus-visible,.di-time-item.has-view .di-time-node{color:var(--di-accent);background:var(--di-blue-soft)}.di-time-node:focus-visible,.di-time-tab:focus-visible,.di-time-flyout-head>button:focus-visible{outline:3px solid var(--di-focus);outline-offset:2px}.di-time-dot{width:7px;height:7px;flex:0 0 auto;border:2px solid var(--di-line-5);border-radius:50%;background:var(--di-white)}.di-time-item.is-current .di-time-dot{border-color:var(--di-accent);background:var(--di-blue);box-shadow:0 0 0 4px var(--di-focus)}.di-time-flyout{position:fixed;right:82px;top:112px;width:min(390px,calc(100vw - 112px));max-height:calc(100vh - 144px);overflow:hidden;border:1px solid var(--di-line);border-radius:11px;background:var(--di-white);box-shadow:var(--di-shadow-pop)}.di-time-flyout-head{display:flex;align-items:stretch;border-bottom:1px solid var(--di-line)}.di-time-tabs{display:flex;align-items:stretch;min-width:0;padding-left:14px}.di-time-tab{appearance:none;position:relative;border:0;padding:13px 2px 11px;margin-right:20px;background:transparent;color:var(--di-muted);font:var(--di-weight-text) 12px/1 "Segoe UI Variable","Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer}.di-time-tab::after{content:"";position:absolute;right:0;bottom:-1px;left:0;height:2px;border-radius:2px;background:transparent}.di-time-tab:hover{color:var(--di-ink)}.di-time-tab.is-active{color:var(--di-accent)}.di-time-tab.is-active::after{background:var(--di-blue)}.di-time-flyout-head>button{appearance:none;width:42px;border:0;margin-left:auto;background:transparent;color:var(--di-muted);font-size:20px;line-height:1;cursor:pointer}.di-time-flyout-head>button:hover{color:var(--di-ink);background:var(--di-paper)}.di-time-flyout-body{max-height:calc(100vh - 188px);padding:15px 16px;overflow:auto;font-size:13px;line-height:1.7}.di-time-records{display:grid;gap:16px}.di-time-record{padding-bottom:15px;border-bottom:1px solid var(--di-line)}.di-time-record:last-child{padding-bottom:0;border-bottom:0}.di-time-record-label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:var(--di-muted);font-size:11px;font-weight:var(--di-weight-text)}.di-time-content-label{margin-bottom:4px;color:var(--di-muted);font-size:11px;font-weight:var(--di-weight-text)}.di-time-record-review{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--di-paper)}.di-time-answer>.di-time-memorize{margin-top:14px;padding:12px;border-radius:8px;background:var(--di-green-soft)}.di-time-empty{padding:16px 4px;text-align:center;color:var(--di-muted)}
.di-lc-problem-card>.di-section,.di-lc-problem-card>.di-notice{grid-column:1/-1}
.di-workspace-backdrop{position:fixed;z-index:53;inset:0;display:grid;place-items:center;padding:32px;background:var(--di-backdrop);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}.di-workspace-panel{position:relative;right:auto;bottom:auto;width:min(1024px,calc(100vw - 64px));height:min(720px,calc(100vh - 64px));min-height:640px;border:1px solid var(--di-line-3);border-radius:16px;background:var(--di-surface);box-shadow:var(--di-shadow-card)}.di-workspace-head{height:64px;padding:0 24px;border-bottom-color:var(--di-line);background:var(--di-veil-strong);backdrop-filter:blur(8px)}.di-workspace-brand{display:flex;align-items:center;gap:10px}.di-workspace-brand-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--di-accent-tint);color:var(--di-accent);box-shadow:none}.di-workspace-head h2{font-size:16px;letter-spacing:-.015em}.di-workspace-head>button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;color:var(--di-faint)}.di-workspace-head>button:hover{color:var(--di-ink-2);background:var(--di-sunken)}.di-workspace-layout{grid-template-columns:208px minmax(0,1fr);height:calc(100% - 64px)}.di-workspace-tabs{gap:4px;padding:12px;border-right-color:var(--di-line);background:var(--di-veil)}.di-workspace-tabs button{display:flex;align-items:center;gap:10px;border-radius:12px;padding:9px 12px;color:var(--di-ink-3);font-size:12px;line-height:1.2}.di-workspace-tabs button::before{display:none}.di-workspace-tabs button:hover{color:var(--di-ink);background:var(--di-sunken)}.di-workspace-tabs button.is-active{color:var(--di-accent);background:var(--di-accent-soft);box-shadow:none}.di-workspace-count{margin-left:auto;min-width:20px;padding:2px 6px;border-radius:999px;background:var(--di-accent-strong);color:var(--di-on-accent);font-size:10px;line-height:1.2;text-align:center}.di-workspace-content{padding:24px;background:var(--di-surface)}.di-workspace-content>.di-ledger,.di-workspace-content>.di-lc-catalog{border:0;border-radius:0;background:var(--di-surface);box-shadow:none;overflow:visible}.di-history-head{min-height:auto;padding:0 0 20px;border:0}.di-ledger-title{font-size:18px}.di-history-head .di-button{height:34px;padding:0 14px;border-radius:12px;box-shadow:var(--di-shadow-accent)}.di-history-filters{gap:10px;margin-bottom:20px;padding:0;border:0;background:var(--di-surface)}.di-history-filters .di-input{padding-left:14px}.di-input,.di-select{height:34px;border-color:var(--di-line-3);border-radius:12px;background:var(--di-field);font-size:12px}.di-input:hover,.di-select:hover{border-color:var(--di-line-4)}.di-history-scroll{border:1px solid var(--di-line);border-radius:12px;box-shadow:var(--di-shadow-soft)}.di-history-table th{padding:12px 16px;border:0;border-bottom:1px solid var(--di-line);background:var(--di-veil);color:var(--di-faint);font-size:12px}.di-history-table td{padding:14px 16px;border-top-color:var(--di-line);color:var(--di-ink-2)}.di-history-table tbody tr{transition:background .15s ease}.di-history-table tbody tr:hover td{background:var(--di-veil)}.di-history-table tr.is-selected td{background:var(--di-accent-soft)}.di-history-topic{max-width:280px;overflow:hidden;text-overflow:ellipsis;color:var(--di-ink)}.di-mode-badge{display:inline-flex;padding:3px 8px;border-radius:6px;background:var(--di-accent-badge);color:var(--di-accent-badge-ink);font-size:11px}.di-mode-badge.is-leetcode{background:var(--di-accent-soft);color:var(--di-accent)}.di-mode-badge.is-scenario{background:var(--di-success-soft);color:var(--di-success)}.di-mode-badge.is-mock{background:var(--di-warn-soft);color:var(--di-warn-ink)}.di-row-actions{gap:4px;opacity:.8}.di-history-table tr:hover .di-row-actions{opacity:1}.di-icon-button{width:28px;height:28px;border-color:transparent;border-radius:8px;background:transparent;color:var(--di-faint)}.di-icon-button:hover:not(:disabled){transform:none;color:var(--di-ink-2);background:var(--di-sunken);box-shadow:none}.di-icon-button.is-delete{border-color:transparent;background:transparent;color:var(--di-faint)}.di-icon-button.is-delete:hover:not(:disabled){color:var(--di-danger);background:var(--di-danger-soft)}.di-history-empty{min-height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;border:1px dashed var(--di-line-3);border-radius:12px;background:var(--di-veil);color:var(--di-faint);font-size:12px;text-align:center}.di-history-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;margin-bottom:12px;border-radius:16px;background:var(--di-sunken);color:var(--di-faint);box-shadow:inset var(--di-shadow-soft)}.di-history-empty-title{margin-bottom:4px;color:var(--di-ink-2);font-size:14px;font-weight:var(--di-weight-title)}.di-history-detail{margin-top:18px;border:1px solid var(--di-line);border-radius:12px;background:var(--di-surface)}.di-detail{padding:20px}.di-detail-heading{padding-bottom:14px;border-bottom:1px solid var(--di-line)}.di-practice-form{margin-bottom:20px;border:1px solid var(--di-line);border-radius:12px;background:var(--di-surface-3)}.di-modal-backdrop{position:absolute;z-index:20;inset:0;display:grid;place-items:center;padding:16px;background:var(--di-backdrop-2);backdrop-filter:blur(4px)}.di-confirm-modal{width:min(384px,100%);padding:20px;border:1px solid var(--di-line);border-radius:16px;background:var(--di-surface);box-shadow:var(--di-shadow-modal)}.di-confirm-copy{display:flex;align-items:flex-start;gap:14px}.di-confirm-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 auto;border-radius:12px;background:var(--di-danger-soft);color:var(--di-danger)}.di-confirm-modal h4{margin:0;color:var(--di-ink);font-size:14px;font-weight:var(--di-weight-title)}.di-confirm-modal p{margin:4px 0 0;color:var(--di-muted);font-size:12px;line-height:1.6}.di-confirm-modal .di-actions{justify-content:flex-end;margin-top:16px;padding-top:10px;border-top:1px solid var(--di-surface-3)}.di-confirm-modal .di-button{padding:7px 12px;border-color:transparent}.di-confirm-modal .di-button.is-danger{background:var(--di-danger);border-color:var(--di-danger);color:#fff}.di-lc-catalog-head{padding:0 0 20px}.di-lc-heading{display:flex;align-items:center;gap:8px}.di-lc-title{font-size:18px}.di-lc-source{padding:3px 8px;border-radius:999px;background:var(--di-accent-soft);color:var(--di-accent);font-size:11px}.di-lc-catalog-summary{gap:8px;padding:6px 14px;border:1px solid var(--di-line);border-radius:12px;background:var(--di-surface-3)}.di-lc-progress-label{color:var(--di-faint);font-size:11px}.di-lc-progress-copy{gap:4px;color:var(--di-ink-2);font-size:12px}.di-lc-progress-value{color:var(--di-accent);font-size:14px}.di-lc-progress{width:48px;height:8px;margin:0;background:var(--di-line-3)}.di-lc-progress>i{background:var(--di-accent)}.di-lc-groups{display:grid;gap:24px;padding:0}.di-lc-group{display:block;padding:0;border:0}.di-lc-group-head{padding:0 4px;margin-bottom:10px}.di-lc-group-head h3{color:var(--di-ink);font-size:12px}.di-lc-group-head span{font-size:12px}.di-lc-problems{border:1px solid var(--di-line);border-radius:12px;background:var(--di-surface);box-shadow:var(--di-shadow-soft);overflow:hidden}.di-lc-row{min-height:46px;padding:8px 12px;border-radius:0}.di-lc-row+.di-lc-row{border-top:1px solid var(--di-line)}.di-lc-row:hover{background:var(--di-veil)}.di-lc-check{width:16px;height:16px;border-color:var(--di-line-4);border-radius:4px;line-height:13px}.di-lc-problem-link{font-size:12px}.di-lc-problem-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--di-faint)}.di-lc-difficulty{min-width:auto;padding:3px 8px;border-radius:6px;font-size:10px}.di-local-toast{right:24px;bottom:24px}
.di-custom-select{position:relative;min-width:0}.di-custom-select-trigger{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;height:34px;padding:0 10px 0 13px;border:1px solid var(--di-line-3);border-radius:12px;background:var(--di-surface);color:var(--di-ink-2);font:var(--di-weight-text) 12px/1 Inter,"Segoe UI","Microsoft YaHei",sans-serif;text-align:left;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}.di-custom-select-trigger:hover:not(:disabled){border-color:var(--di-line-4)}.di-custom-select-trigger .is-placeholder{color:var(--di-faint)}.di-custom-select-trigger .di-icon{color:var(--di-faint);transition:transform .15s ease}.di-custom-select.is-open .di-custom-select-trigger{border-color:var(--di-accent);box-shadow:0 0 0 3px var(--di-focus)}.di-custom-select.is-open .di-custom-select-trigger .di-icon{transform:rotate(180deg)}.di-custom-select.is-disabled{opacity:.55}.di-custom-select-menu{position:absolute;z-index:40;top:calc(100% + 6px);right:0;left:0;max-height:220px;padding:5px;border:1px solid var(--di-line-3);border-radius:12px;background:var(--di-surface);box-shadow:var(--di-shadow-pop);overflow:auto}.di-custom-select-option{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:32px;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--di-ink-3);font:var(--di-weight-text) 12px/1.3 Inter,"Segoe UI","Microsoft YaHei",sans-serif;text-align:left;cursor:pointer}.di-custom-select-option:hover,.di-custom-select-option:focus-visible{outline:0;background:var(--di-surface-3);color:var(--di-ink)}.di-custom-select-option.is-selected{background:var(--di-accent-soft);color:var(--di-accent)}.di-custom-select-option:disabled{opacity:.45;cursor:not-allowed}.di-history-mode-select{width:144px;flex:0 0 144px}
@keyframes di-spin{to{transform:rotate(360deg)}}
@keyframes di-config-enter{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
@media(max-width:760px){.di-detail-heading{align-items:flex-start;flex-direction:column;gap:5px}.di-lc-catalog-summary{gap:10px}}
@media(max-width:760px){.di-question-card,.di-lc-problem-card{grid-template-columns:1fr;padding:22px}.di-lc-problem-actions{justify-content:flex-start;max-width:none}.di-lc-group{grid-template-columns:1fr;gap:10px}.di-lc-group-head{justify-content:flex-start}.di-answer-button{justify-self:start}.di-history-table th,.di-history-table td{padding-left:16px;padding-right:16px}.di-history-filters{flex-wrap:wrap}.di-input{flex-basis:100%}.di-timeline{display:none}.di-workspace-backdrop{padding:8px;place-items:stretch}.di-workspace-panel{width:100%;height:100%;min-height:0;border-radius:12px}.di-workspace-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.di-workspace-tabs{flex-direction:row;padding:6px;border-right:0;border-bottom:1px solid var(--di-line);overflow-x:auto}.di-workspace-tabs button{white-space:nowrap}.di-workspace-count{display:none}.di-workspace-content{padding:16px}.di-lc-catalog-head{align-items:flex-start;flex-direction:column}}
@media(max-width:520px){.di-card-body{padding:18px}.di-question-text{font-size:17px}.di-review-score{flex-wrap:wrap;padding:18px}.di-review-score-summary{flex:1}.di-stars{width:100%;margin-left:56px}.di-review-content{padding:20px 18px}.di-review-actions{justify-content:flex-start}.di-history-head{padding:17px 18px}.di-history-filters{padding:10px 18px}.di-history-mode-select{width:100%;flex:1 1 100%}.di-practice-form{grid-template-columns:1fr;padding:16px 18px}.di-field-wide{grid-column:1}.di-config-fields{grid-template-columns:1fr}.di-mode-options{grid-template-columns:repeat(2,minmax(0,1fr))}.di-config-progress li+li::before{width:24px;margin-right:7px;margin-left:7px}.di-delete-confirm{align-items:flex-start;flex-direction:column;margin:10px 18px}.di-lc-catalog-head{align-items:flex-start;padding:20px;}.di-lc-progress{margin-right:20px;margin-left:20px}.di-lc-groups{padding-right:20px;padding-left:20px}.di-lc-row{grid-template-columns:22px minmax(0,1fr) 44px}.di-lc-problem-id{display:none}}
@media(prefers-reduced-motion:reduce){.di-button,.di-time-node,.di-lc-progress>i,.di-mode-option{transition:none}.di-config-stage{animation:none}.di-spinner{animation-duration:1.5s}}
.di-lc-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 0 12px}.di-lc-toolbar .di-lc-search{flex:1 1 260px;height:34px}.di-lc-filter-select{width:132px;flex:0 0 132px}.di-lc-toolbar-note{display:flex;align-items:center;gap:10px;padding-bottom:14px}.di-lc-catalog-config{padding:0 0 20px}.di-lc-config-note{margin:0 0 10px}.di-lc-row.is-selectable{grid-template-columns:24px minmax(0,1fr) 52px 88px}.di-lc-start{appearance:none;height:26px;padding:0 10px;border:1px solid var(--di-line-3);border-radius:8px;background:var(--di-surface);color:var(--di-accent);font:var(--di-weight-text) 11px/1 Inter,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}.di-lc-start:hover:not(:disabled){border-color:var(--di-accent);background:var(--di-accent-soft)}.di-lc-start:disabled{opacity:.5;cursor:not-allowed}.di-lc-difficulty.is-custom{color:var(--di-accent-badge-ink);background:var(--di-accent-badge)}
.di-lc-custom{margin:0 0 14px;padding:14px 16px;border:1px dashed var(--di-line-3);border-radius:12px;background:var(--di-veil)}.di-lc-custom-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px}.di-lc-custom-title{color:var(--di-ink);font-size:13px;font-weight:var(--di-weight-title)}.di-lc-custom-fields{display:grid;grid-template-columns:120px minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:center}
.di-guidance-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;background:var(--di-sunken);color:var(--di-ink-3);font-size:10px}.di-guidance-badge.is-guided{background:var(--di-success-soft);color:var(--di-success-ink)}.di-guidance-hint{padding:8px 10px;border-radius:8px;background:var(--di-accent-tint);color:var(--di-accent-ink);font-size:12px;line-height:1.6}
.di-lc-material-actions{display:flex;align-items:center;gap:10px;padding-top:14px}.di-lc-material-section{border-top:1px solid var(--di-line);margin-top:14px}.di-lc-materials{display:grid;gap:16px;margin-top:12px}.di-lc-material-block{display:grid;gap:6px}.di-lc-material-label{color:var(--di-faint);font-size:11px;font-weight:var(--di-weight-text)}.di-lc-materials .di-markdown{font-size:13px;line-height:1.75}.di-lc-examples{display:grid;gap:8px}.di-lc-example{display:grid;gap:4px;padding:9px 11px;border:1px solid var(--di-line);border-radius:10px;background:var(--di-veil);font-size:12px;line-height:1.6}.di-lc-example>div{display:flex;gap:8px;align-items:baseline}.di-lc-example>div>span:first-child{flex:0 0 32px;color:var(--di-faint)}.di-lc-example code{word-break:break-all}.di-lc-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}.di-lc-chips li code{padding:2px 7px;border-radius:6px;background:var(--di-sunken);color:var(--di-ink-2);font-size:11px}.di-lc-knowledge+.di-lc-knowledge{margin-top:8px}.di-lc-knowledge{font-size:12px;line-height:1.7}.di-lc-knowledge strong{display:block;color:var(--di-ink)}.di-lc-hints{display:grid;gap:6px;margin:0;padding-left:18px;font-size:12px;line-height:1.7}.di-lc-hints li.is-locked{color:var(--di-faint)}.di-lc-hints li.is-revealed{color:var(--di-ink-2)}.di-lc-related{display:grid;gap:4px;margin:0;padding-left:18px;font-size:12px}
.di-lc-material-source{padding-top:8px;border-top:1px solid var(--di-line);color:var(--di-muted);font-size:11px;line-height:1.6}.di-lc-picker{margin-top:14px;padding:14px 16px;border:1px solid var(--di-line-3);border-radius:12px;background:var(--di-surface);box-shadow:var(--di-shadow)}.di-lc-picker-list{display:grid;gap:2px;max-height:264px;overflow:auto}.di-lc-picker-row{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--di-ink-2);font:var(--di-weight-text) 12px/1.4 Inter,"Segoe UI","Microsoft YaHei",sans-serif;text-align:left;cursor:pointer}.di-lc-picker-row:hover:not(:disabled){background:var(--di-surface-3);color:var(--di-ink)}.di-lc-picker-row:disabled{opacity:.55;cursor:wait}.di-lc-picker-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.di-lc-picker-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}
@media(max-width:760px){.di-lc-row.is-selectable{grid-template-columns:22px minmax(0,1fr) 44px;row-gap:6px}.di-lc-row.is-selectable .di-lc-start{grid-column:2/-1;justify-self:start}.di-lc-custom-fields{grid-template-columns:1fr}.di-lc-filter-select{width:100%;flex:1 1 100%}.di-lc-material-actions{flex-wrap:wrap}}
/* \u4EE3\u7801\u4F5C\u7B54\u4E0E\u6B63\u786E\u7B54\u6848\u906E\u853D */
.di-question-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.di-question-card>.di-code-answer{grid-column:1/-1}
.di-code-answer{margin-top:18px;border:1px solid var(--di-line-3);border-radius:12px;overflow:hidden;background:var(--di-surface)}
.di-code-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;background:var(--di-surface-2);border-bottom:1px solid var(--di-line-2)}
.di-code-title{display:flex;align-items:center;gap:7px;margin-bottom:5px;font-size:14px;font-weight:var(--di-weight-title)}.di-code-language{display:flex;align-items:center;gap:8px;color:var(--di-muted);font-size:12px;flex-shrink:0}.di-code-language select{width:125px;padding:7px 9px;min-height:32px}
.di-code-field{position:relative;background:var(--di-field)}.di-code-lines,.di-code-input{font:14px/24px Consolas,"Cascadia Code","SFMono-Regular",monospace;tab-size:4}
.di-code-lines{position:absolute;top:0;bottom:0;left:0;z-index:1;width:55px;overflow:hidden;margin:0;padding:14px 10px;background:var(--di-surface-3);color:var(--di-faint);border-right:1px solid var(--di-line-2);text-align:right;pointer-events:none;user-select:none}
.di-code-input{display:block;width:100%;min-height:288px;max-height:70vh;resize:vertical;border:0;outline:0;border-radius:0;margin:0;padding:14px 16px 14px 70px;background:transparent;color:var(--di-ink);white-space:pre;overflow:auto}.di-code-input:focus{box-shadow:inset 0 0 0 2px var(--di-focus)}.di-code-input::placeholder{color:var(--di-faint)}
.di-code-notes{display:grid;gap:7px;padding:13px 16px;color:var(--di-muted);font-size:12px;border-top:1px solid var(--di-line-2)}.di-code-notes textarea{resize:vertical;line-height:1.6;min-height:60px}
.di-code-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-top:1px solid var(--di-line-2);background:var(--di-surface-2)}.di-code-answer>.di-error{margin:12px 16px}.di-code-footer .di-button{flex-shrink:0;min-height:36px}
.di-solution-disclosure{margin-top:16px;border:1px dashed var(--di-line-4);border-radius:10px;overflow:hidden;background:var(--di-surface-2)}.di-solution-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px}.di-solution-toggle .di-button{flex-shrink:0}.di-solution-body{padding:16px;background:var(--di-surface);border-top:1px solid var(--di-line-2)}.di-solution-body>.di-section:first-child,.di-solution-body>.di-review-section:first-child{margin-top:0}
@media(max-width:760px){.di-question-actions{justify-content:flex-start}.di-code-toolbar{align-items:flex-start;flex-wrap:wrap}.di-code-language{width:100%;justify-content:space-between}.di-code-language select{width:150px}.di-code-input{font-size:13px;min-height:240px;padding-left:60px}.di-code-lines{width:45px;font-size:13px}.di-code-footer{align-items:stretch;flex-direction:column;gap:10px}.di-code-footer .di-button{width:100%}.di-solution-toggle{align-items:flex-start;flex-wrap:wrap}}
/* \u5B8C\u6574\u9898\u9762\u3001\u5206\u7EA7\u5F15\u5BFC\u4E0E\u53C2\u8003\u7B54\u6848 */
.di-learning-panel{display:grid;gap:16px;margin-top:16px;padding:16px;border:1px solid var(--di-line-2);border-radius:12px;background:var(--di-surface)}.di-question-card>.di-learning-panel,.di-question-card>.di-solution-disclosure{grid-column:1/-1}
.di-learning-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.di-learning-heading h4{margin:0;color:var(--di-ink);font-size:14px;font-weight:var(--di-weight-title)}.di-learning-heading .di-button{flex-shrink:0}.di-problem-body{display:grid;gap:16px;font-size:13px;line-height:1.75}.di-problem-body h5,.di-guided-panel h5{margin:0 0 8px;color:var(--di-muted);font-size:12px;font-weight:var(--di-weight-text)}.di-problem-body .di-markdown{font-size:13px}.di-problem-body .di-lc-example+.di-lc-example{margin-top:8px}.di-learning-example-title{color:var(--di-muted)}.di-learning-constraints{display:grid;gap:4px;margin:0;padding-left:20px;color:var(--di-ink-2)}.di-learning-constraints code{white-space:pre-wrap;overflow-wrap:anywhere}.di-learning-source{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--di-line)}
.di-guided-panel{display:grid;gap:14px;padding:16px;border:1px solid var(--di-line-2);border-radius:10px;background:var(--di-accent-tint)}.di-guided-stages{display:flex;gap:7px;flex-wrap:wrap}.di-guided-stages span{padding:4px 8px;border-radius:6px;background:var(--di-surface);color:var(--di-faint);font-size:11px}.di-guided-stages .is-current{color:var(--di-accent-ink);background:var(--di-accent-soft)}.di-guided-intro p{margin:10px 0 0;color:var(--di-muted);font-size:12px;line-height:1.7}.di-guided-knowledge{display:grid;gap:8px}.di-lc-knowledge-title{color:var(--di-ink-2);font-size:12px}.di-guided-panel .di-markdown{font-size:12px;line-height:1.75}.di-guided-hint{padding:12px;border:1px solid var(--di-line-2);border-radius:8px;background:var(--di-surface)}.di-guided-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.di-guided-actions .di-button{flex-shrink:0}.di-solution-source{margin-bottom:12px}.di-solution-missing p{font-size:13px;line-height:1.7}
@media(max-width:760px){.di-learning-panel,.di-guided-panel{padding:12px}.di-learning-heading{flex-wrap:wrap}.di-guided-actions{align-items:stretch;flex-direction:column}.di-problem-body .di-lc-example>div{flex-wrap:wrap}.di-problem-body .di-lc-example code{overflow-wrap:anywhere}}
/* \u7B80\u5386\u4E0E\u53C2\u8003\u8D44\u6599\u5BFC\u5165 */
.di-time-answer-entry{display:grid;gap:10px;margin-bottom:16px}.di-time-answer-entry>.di-meta{margin:0}.di-time-flyout .di-code-input{min-height:220px}
.di-time-flyout{display:flex;flex-direction:column;width:min(680px,calc(100vw - 112px))}.di-time-flyout-body{min-height:0}.di-time-title{flex:1;min-width:0;margin:0;padding:14px 16px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}.di-time-unified{display:grid;gap:20px}.di-time-unified>section>h4{margin:0 0 12px;font-size:14px}.di-time-unified .di-time-records{margin-top:18px;padding-top:16px;border-top:1px solid var(--di-line)}
@media(max-width:760px){.di-timeline{display:block;top:96px;right:6px;width:52px}.di-time-node{width:48px;padding:0 5px}.di-time-flyout{top:96px;right:62px;width:calc(100vw - 76px);max-height:calc(100vh - 120px)}.di-time-flyout-body{max-height:calc(100vh - 180px);padding:12px}.di-time-title{font-size:13px}}
.di-document-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.di-document-head .di-button{flex-shrink:0}.di-resume-document .di-textarea{min-height:160px}.di-document-file{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--di-ink-2);font-size:12px;line-height:1.6}.di-document-file>span{min-width:0;overflow-wrap:anywhere}.di-reference-documents{display:grid;gap:9px;padding:16px;border:1px dashed var(--di-line-3);border-radius:10px;background:var(--di-surface-2)}.di-reference-file{padding:10px 12px;border:1px solid var(--di-line-2);border-radius:8px;background:var(--di-surface)}.di-reference-file summary{padding:7px 0;color:var(--di-muted);font-size:12px;line-height:1.6;cursor:pointer;overflow-wrap:anywhere}.di-reference-file .di-textarea{width:100%;margin-top:7px;min-height:140px;max-height:360px;resize:vertical}.di-reference-documents>.di-error{white-space:pre-wrap}.di-practice-sources{display:grid;gap:9px;margin:14px 0}.di-document-text{margin:8px 0 0;color:var(--di-ink-2);font:12px/1.7 "Segoe UI","Microsoft YaHei",sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto}
@media(max-width:760px){.di-document-head,.di-document-file{flex-wrap:wrap}.di-reference-documents{padding:12px}}
/* \u4E13\u9898\u8BAD\u7EC3\u548C\u53EF\u591A\u9009\u7684\u96BE\u5EA6\u6807\u7B7E */
.di-difficulty-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.di-difficulty-tag{--di-difficulty-color:var(--di-muted);appearance:none;display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:6px 12px;border:1px solid var(--di-line-3);border-radius:8px;background:var(--di-surface);color:var(--di-difficulty-color);font:var(--di-weight-text) 12px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer}.di-difficulty-tag.is-easy{--di-difficulty-color:var(--di-success-ink)}.di-difficulty-tag.is-medium{--di-difficulty-color:var(--di-warn-ink)}.di-difficulty-tag.is-hard{--di-difficulty-color:var(--di-danger-ink)}.di-difficulty-tag.is-selected{border-color:var(--di-difficulty-color);background:var(--di-accent-tint);box-shadow:inset 0 0 0 1px var(--di-difficulty-color)}.di-difficulty-tag:disabled{opacity:.5;cursor:not-allowed}.di-difficulty-tag:focus-visible{outline:3px solid var(--di-focus);outline-offset:2px}.di-difficulty-count{font-size:10px;opacity:.8}.di-training-controls{display:grid;gap:12px;margin:18px 0;padding:16px;border:1px solid var(--di-line-3);border-radius:10px;background:var(--di-surface-2)}.di-training-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--di-ink-2);font-size:13px}.di-training-heading .di-select{min-width:180px}.di-training-actions,.di-training-catalog-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.di-training-catalog-actions{padding:14px 0}.di-training-catalog-actions>.di-meta{flex:1 1 180px}.di-problem-tags{display:inline-flex;align-items:center;gap:9px;flex-wrap:wrap}.di-lc-picker>.di-difficulty-tags{margin-bottom:12px}
@media(max-width:760px){.di-training-heading{align-items:stretch;flex-direction:column}.di-training-actions .di-button{flex:1 1 160px}.di-training-controls{padding:12px}}
`;
function installStyles() {
  if (document.getElementById("dsh-interview-styles")) return;
  const style = document.createElement("style");
  style.id = "dsh-interview-styles";
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

// src/client/index.js
var name = "dsh-interview";
var inject = ["slots"];
function resolveToolView(toolName, block) {
  const state = toolCallState(block);
  if (state === "running") return { kind: "hidden" };
  if (state === "error" && toolErrorAudience(block) === "agent") return { kind: "hidden" };
  if (state === "error") return { kind: "error", message: toolErrorMessage(block) };
  const result = parseInteractionResult(block);
  if (!result || result.error?.audience === "agent" || !result.artifact) return { kind: "hidden" };
  return { ...result.artifact, revision: result.revision, toolName };
}
function ToolResourceView({ toolName, sessionId, block }) {
  const view = resolveToolView(toolName, block);
  switch (view.kind) {
    case "error":
      return h(ToolErrorCard, { message: view.message });
    case "practice-setup":
      return h(PracticeSetupCard, { key: view.presentationId, sessionId });
    case "question":
      return h(QuestionResourceCard, { key: view.presentationId, artifact: view, revision: view.revision, sessionId });
    case "review":
      return h(ReviewResourceCard, { key: view.presentationId, artifact: view, revision: view.revision, sessionId });
    case "library":
      return h(PracticeLibrary, { sessionId, initialPracticeId: view.practiceId });
    case "insights":
      return h(InsightsCard);
    case "leetcode-catalog":
      return h(LeetcodeCatalog, { sessionId });
    case "deleted":
      return h(CompactResultCard, { title: "\u7EC3\u4E60\u5DF2\u5220\u9664", detail: "\u6863\u6848\u548C\u5BF9\u5E94\u4F1A\u8BDD\u6E38\u6807\u5DF2\u7ECF\u6E05\u7406\u3002" });
    case "exported":
      return h(CompactResultCard, { title: "Markdown \u5DF2\u751F\u6210", detail: "\u6253\u5F00\u7EC3\u4E60\u6863\u6848\u53EF\u4EE5\u4E0B\u8F7D\u672C\u6B21\u5BFC\u51FA\u3002" });
    case "finished":
      return h(PracticeSummaryCard, { artifact: view, revision: view.revision });
    default:
      return null;
  }
}
function apply(ctx) {
  installStyles();
  const slots = ctx.get("slots");
  if (!slots) return;
  for (const toolName of INTERVIEW_TOOL_NAMES) {
    slots.inject("tool.call.toolview", () => slots.register(
      { name: "tool.call.toolview", key: toolName },
      (props) => h(ToolResourceView, { toolName, sessionId: props.sessionId, block: props.block })
    ));
  }
  slots.inject("sidebar.footer.action", () => slots.register(
    { name: "sidebar.footer.action", id: "interview-workspace", order: 20 },
    (props) => h(WorkspaceSidebarEntry, { wide: props.wide, useSessions: props.useSessions })
  ));
  slots.inject("conversation.input.dock", () => slots.register(
    { name: "conversation.input.dock", id: "interview-timeline", order: 25 },
    (props) => {
      const revisionSignal = typeof props.useSession === "function" ? props.useSession((snapshot) => {
        const order = snapshot?.chat?.order || [];
        return `${order.length}:${order.at(-1) || ""}`;
      }) : "";
      return h(TimelinePanel, { sessionId: props.sessionId, revisionSignal });
    }
  ));
}
return module.exports; }});
