(function () {
  var catalog = window.GROK_CATALOG;
  var countEl = document.getElementById("catalog-count");
  var jsonlEl = document.getElementById("jsonl-count");
  var listEl = document.getElementById("list");
  var metaEl = document.getElementById("result-meta");
  var pagerEl = document.getElementById("pager");
  var detailEl = document.getElementById("detail-frame");
  var detailSection = document.getElementById("detail");
  var catalogEl = document.getElementById("catalog");
  var typeSelect = document.getElementById("ext");
  var placeSelect = document.getElementById("scope");
  var sourceSelect = document.getElementById("area");
  var page = 1;
  var pageSize = 24;

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function fmtNum(n) {
    if (typeof n !== "number" || !isFinite(n)) return String(n);
    if (Math.floor(n) === n) return fmt(n);
    return String(n);
  }

  if (!Array.isArray(catalog)) {
    countEl.textContent = "Catalog missing";
    return;
  }

  var jsonlRecords = 0;
  for (var i = 0; i < catalog.length; i++) {
    if (typeof catalog[i].line === "number") jsonlRecords += 1;
  }

  countEl.dataset.count = String(catalog.length);
  countEl.textContent = fmt(catalog.length);
  jsonlEl.dataset.count = String(jsonlRecords);
  jsonlEl.dataset.files = String(catalog.length - jsonlRecords);
  jsonlEl.textContent = fmt(jsonlRecords);

  var ruleEl = document.getElementById("count-rule");
  if (ruleEl) {
    var counted = document.createElement("span");
    counted.id = "counted-split";
    counted.textContent = " Counted " + fmt(catalog.length) + " entries: " + fmt(jsonlRecords) + " JSONL records and " + fmt(catalog.length - jsonlRecords) + " other files.";
    ruleEl.append(counted);
  }

  var byPath = new Map();
  catalog.forEach(function (entry) {
    byPath.set(entry.path, entry);
  });

  function option(value, label) {
    var node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function fillSelect(select, counts, allLabel, labelOf) {
    var names = Array.from(counts.keys()).sort(function (a, b) {
      return counts.get(b) - counts.get(a) || a.localeCompare(b);
    });
    select.append(option("all", allLabel));
    names.forEach(function (name) {
      var label = labelOf ? labelOf(name) : name;
      select.append(option(name, label + " (" + fmt(counts.get(name)) + ")"));
    });
  }

  function tally(key) {
    var counts = new Map();
    catalog.forEach(function (entry) {
      var value = entry[key] || "none";
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
  }

  fillSelect(typeSelect, tally("type"), "All types (" + fmt(catalog.length) + ")");
  fillSelect(placeSelect, tally("place"), "All places (" + fmt(catalog.length) + ")", function (place) {
    return place === "dataset" ? "Dataset root" : place;
  });
  fillSelect(sourceSelect, tally("source"), "All sources (" + fmt(catalog.length) + ")", function (source) {
    var prefix = "grokbot-posts/";
    return source.indexOf(prefix) === 0 ? source.slice(prefix.length) : source;
  });

  function statBits(entry, brief) {
    var stats = entry.stats || {};
    var bits = [];
    if (typeof entry.line === "number") bits.push("line " + fmt(entry.line));
    if (stats.id) bits.push(String(stats.id));
    var dates = stats.dates || [];
    var dateLimit = brief ? Math.min(1, dates.length) : dates.length;
    for (var d = 0; d < dateLimit; d++) {
      bits.push(dates[d].key + " " + dates[d].value);
    }
    var counts = stats.counts || [];
    var countLimit = brief ? Math.min(3, counts.length) : counts.length;
    for (var c = 0; c < countLimit; c++) {
      bits.push(counts[c].key + " " + fmtNum(counts[c].value));
    }
    if (typeof stats.bytes === "number") bits.push(fmt(stats.bytes) + " bytes");
    if (typeof stats.lines === "number" && (typeof entry.line !== "number" || !brief)) {
      bits.push(fmt(stats.lines) + (stats.lines === 1 ? " line" : " lines"));
    }
    if (!brief && typeof stats.chars === "number") bits.push(fmt(stats.chars) + " chars");
    return bits;
  }

  function collect(value, parts) {
    if (value == null) return;
    var kind = typeof value;
    if (kind === "string" || kind === "number" || kind === "boolean") {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) collect(value[i], parts);
      return;
    }
    if (kind === "object") {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        parts.push(keys[k]);
        collect(value[keys[k]], parts);
      }
    }
  }

  function hay(entry) {
    if (entry._hay) return entry._hay;
    var parts = [entry.name, entry.path, entry.source, entry.description, (entry.tags || []).join(" ")];
    collect(entry.record, parts);
    if (typeof entry.text === "string") parts.push(entry.text);
    entry._hay = parts.join("\n").toLowerCase();
    return entry._hay;
  }

  function filtered() {
    var raw = document.getElementById("q").value.trim().toLowerCase();
    var terms = raw ? raw.split(/\s+/) : [];
    var type = typeSelect.value;
    var place = placeSelect.value;
    var source = sourceSelect.value;
    return catalog.filter(function (entry) {
      if (type !== "all" && entry.type !== type) return false;
      if (place !== "all" && entry.place !== place) return false;
      if (source !== "all" && entry.source !== source) return false;
      if (!terms.length) return true;
      var blob = hay(entry);
      for (var t = 0; t < terms.length; t++) {
        if (blob.indexOf(terms[t]) === -1) return false;
      }
      return true;
    });
  }

  function renderList() {
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var start = (page - 1) * pageSize;
    var slice = rows.slice(start, start + pageSize);

    if (!rows.length) {
      metaEl.textContent = "No records match.";
    } else {
      var end = Math.min(rows.length, start + slice.length);
      metaEl.textContent = "Showing " + fmt(start + 1) + "–" + fmt(end) + " of " + fmt(rows.length);
    }

    listEl.replaceChildren();
    slice.forEach(function (entry) {
      var card = document.createElement("a");
      card.className = "card";
      card.href = "#/file/" + encodeURIComponent(entry.path);

      var mark = markFor(entry);
      var art = staffCard(staffId(entry), "list");
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = mark.label;
      var title = document.createElement("p");
      title.className = "card-title";
      title.textContent = displayTitle(entry);
      var blurb = calmDescription(entry, title.textContent);
      card.append(art, chip, title);
      if (blurb) {
        var desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = blurb;
        card.append(desc);
      }
      listEl.append(card);
    });

    pagerEl.replaceChildren();
    if (rows.length > pageSize) {
      pagerEl.append(
        pagerButton("First", page === 1, function () { page = 1; renderList(); }),
        pagerButton("Previous", page === 1, function () { page -= 1; renderList(); })
      );
      var label = document.createElement("p");
      label.className = "page-label";
      label.textContent = "Page " + fmt(page) + " of " + fmt(pages);
      pagerEl.append(label);
      pagerEl.append(
        pagerButton("Next", page === pages, function () { page += 1; renderList(); }),
        pagerButton("Last", page === pages, function () { page = pages; renderList(); })
      );
    }
  }

  function pagerButton(text, disabled, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  function sourceNote(entry) {
    var from = entry.descriptionFrom || "record";
    if (from === "markdown") return "Description from the markdown lead";
    if (from === "file-lead") return "Description from the first line";
    if (from === "docstring") return "Description from the module docstring";
    if (from === "format") return "File facts";
    if (from === "fields") return "Description from fields on the record";
    if (from === "steps") return "Description from steps";
    if (from === "raw-line") return "Description from the raw line";
    return "Description from " + from;
  }

  function renderFields(value, depth) {
    var list = document.createElement("ul");
    list.className = "fields";
    if (depth > 0) {
      list.style.margin = "8px 0 0 12px";
      list.style.paddingLeft = "12px";
      list.style.borderLeft = "1px solid #D2D2D7";
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) list.append(fieldRow("[" + i + "]", value[i], depth));
      return list;
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) list.append(fieldRow(keys[k], value[keys[k]], depth));
    return list;
  }

  function fieldRow(key, value, depth) {
    var li = document.createElement("li");
    li.className = "field";
    var keyEl = document.createElement("p");
    keyEl.className = "field-key";
    keyEl.textContent = key;
    li.append(keyEl);

    if (value !== null && typeof value === "object") {
      var meta = document.createElement("p");
      meta.className = "source-note";
      if (Array.isArray(value)) {
        meta.textContent = value.length + (value.length === 1 ? " item" : " items");
      } else {
        var n = Object.keys(value).length;
        meta.textContent = n + (n === 1 ? " key" : " keys");
      }
      li.append(meta);
      if ((Array.isArray(value) && value.length) || (!Array.isArray(value) && Object.keys(value).length)) {
        li.append(renderFields(value, depth + 1));
      }
      return li;
    }

    var valueEl = document.createElement("p");
    valueEl.className = "field-value";
    if (value === null) valueEl.textContent = "null";
    else if (typeof value === "boolean") valueEl.textContent = value ? "true" : "false";
    else if (typeof value === "string") {
      valueEl.textContent = value;
      if (value === "") valueEl.dataset.empty = "true";
    } else valueEl.textContent = String(value);
    li.append(valueEl);
    return li;
  }

  var MARKS = {
    prompts: ["Prompt", "IP-026"],
    skills: ["Skills", "IP-011"],
    skill: ["Skills", "IP-011"],
    templates: ["Template", "IP-023"],
    template_guides: ["Template", "IP-023"],
    workflows: ["Workflow", "IP-009"],
    tutorials: ["Tutorial", "IP-018"],
    code: ["Code", "IP-001"],
    python: ["Code", "IP-001"],
    resources: ["Resource", "IP-022"],
    saved_queries: ["Query", "IP-025"],
    threads: ["Thread", "IP-014"],
    conversations: ["Conversation", "IP-016"],
    dialogue: ["Conversation", "IP-016"],
    article_index: ["Article", "IP-008"],
    official_answers: ["Answer", "IP-021"],
    scaling: ["Note", "IP-029"],
    grokbot_posts: ["Post", "IP-037"],
    labels: ["Post", "IP-037"],
    signals: ["Post", "IP-037"],
    usable: ["Post", "IP-037"],
    profiles: ["Profile", "IP-012"],
    profiles_extra: ["Profile", "IP-012"],
    authors: ["Profile", "IP-012"],
    profile_snapshots: ["Profile", "IP-012"],
    lists: ["List", "IP-034"],
    media: ["Media", "IP-002"],
    markdown: ["File", "IP-032"],
    license: ["File", "IP-032"],
    json: ["File", "IP-032"]
  };

  function humanTitle(entry) {
    var rec = recordOf(entry);
    if (rec.title) return String(rec.title).replace(/\s+/g, " ").trim();
    if (rec.name && rec.username && String(rec.name) !== String(rec.username)) {
      return String(rec.name).replace(/\s+/g, " ").trim();
    }
    if (rec.name && !rec.username) return String(rec.name).replace(/\s+/g, " ").trim();
    return "";
  }

  function stripLeadingMachinePath(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || /^https?:\/\//i.test(text)) return text;
    var patterns = [
      /^[A-Za-z]:[\\/][^\s]+(?:\s*[|:—–-]\s*|\s+)?/,
      /^(?:grokbot-posts|\.{1,2})[\\/][^\s]+(?:\s*[|:—–-]\s*|\s+)?/,
      /^(?:[A-Za-z0-9_.@-]+[\\/])+[A-Za-z0-9_.@-]+\.[A-Za-z0-9]+(?:::L\d+)?(?:\s*[|:—–-]\s*|\s+)?/,
      /^(?:[A-Za-z0-9_.@-]+[\\/])+[A-Za-z0-9_.@-]+::L\d+(?:\s*[|:—–-]\s*|\s+)?/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var match = text.match(patterns[i]);
      if (!match) continue;
      return text.slice(match[0].length).trim();
    }
    return text;
  }

  function descriptionSentence(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var line = raw.split(/\r?\n/)[0].trim().replace(/[ \t]+/g, " ");
    var match = line.match(/^[\s\S]+?[.!?](?=\s|$)/);
    return match ? match[0] : line;
  }

  function plainTitle(entry) {
    var human = humanTitle(entry);
    var desc = String(entry.description || "").replace(/\s+/g, " ").trim();
    var candidate = human || String(entry.name || "");
    if (human || desc) {
      var stripped = stripLeadingMachinePath(candidate);
      if (stripped) return stripped;
      var sentence = descriptionSentence(entry.description);
      if (sentence) return sentence;
    }
    return candidate || entry.path || "";
  }

  function readingParts(entry) {
    var rec = recordOf(entry);
    var parts = [];
    var primary = "";
    if (rec.article_body) primary = String(rec.article_body);
    else if (rec.text) primary = String(rec.text);
    else if (rec.post_text) primary = String(rec.post_text);
    if (primary) parts.push(primary);
    if (typeof entry.text === "string" && entry.text && parts.indexOf(entry.text) === -1) parts.push(entry.text);
    return parts;
  }

  function markFor(entry) {
    var pair = MARKS[entry.type] || ["File", "IP-032"];
    return { label: pair[0], id: pair[1] };
  }

  function staffId(entry) {
    var s = entry.path || "";
    var n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    var num = String((n % 300) + 1);
    while (num.length < 3) num = "0" + num;
    return "IP-" + num;
  }

  function staffCard(id, kind) {
    var img = document.createElement("img");
    img.className = kind === "detail" ? "staff-card staff-card-detail" : "staff-card";
    img.src = "identity/cards/" + id + ".png";
    img.alt = id + " staff card";
    return img;
  }

  function markImg(id, kind) {
    var img = document.createElement("img");
    img.className = kind === "qr" ? "mark-qr" : "mark-icon";
    img.src = "identity/marks/" + id + (kind === "qr" ? "-qr.png" : ".png");
    img.alt = "";
    img.width = kind === "qr" ? 112 : 40;
    img.height = kind === "qr" ? 112 : 40;
    return img;
  }

  function recordOf(entry) {
    return entry.record && typeof entry.record === "object" ? entry.record : {};
  }

  function oneLine(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function stringField(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function promptsJoined(rec) {
    if (!Array.isArray(rec.prompts)) return "";
    return rec.prompts.map(function (item) { return String(item).trim(); }).filter(Boolean).join("\n\n");
  }

  function stepsJoined(rec) {
    if (!Array.isArray(rec.steps)) return "";
    return rec.steps.map(function (item) { return String(item).trim(); }).filter(Boolean).join("\n");
  }

  function isFieldDump(text) {
    var t = String(text || "").trim();
    if (!t) return false;
    if (/^(?:user_id|posts|template_id|post_id|kind|conversation_id|username|list_id|code_id|prompt_id|skill_id|quality_label)\s*:/.test(t)) return true;
    var semis = (t.match(/;/g) || []).length;
    var pairs = t.match(/\b[\w.]+:\s/g);
    if (!pairs || pairs.length < 2 || semis < 2) return false;
    return t.length < 420 && t.indexOf("\n") === -1;
  }

  function isMachineLabel(text) {
    var t = oneLine(text);
    if (!t) return false;
    if (/^https?:\/\//i.test(t)) return true;
    if (/\.(md|jsonl|json|py|txt|png|jpe?g|svg|csv|zip|js|css|html)$/i.test(t)) return true;
    if (/^[A-Za-z]:\\/.test(t) || /[\\/]/.test(t) || /::L\d+$/.test(t)) return true;
    return false;
  }

  function verbatimSurface(entry) {
    return entry.type === "code" || entry.type === "python";
  }

  function shouting(text) {
    var letters = String(text || "").replace(/[^A-Za-z]/g, "");
    if (letters.length < 12) return false;
    return letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.55;
  }

  function splitSentences(text) {
    var out = [];
    String(text || "").replace(/\r/g, "").split(/\n+/).forEach(function (line) {
      line.trim().split(/(?<=[.!?])\s+/).forEach(function (bit) {
        var cleaned = bit.replace(/\s+/g, " ").trim();
        cleaned = cleaned.replace(/^[\s>*•\-–—→]+/, "");
        cleaned = cleaned.replace(/^(?:step\s*)?\d+\s*[.):/\-–—)]+\s*/i, "");
        cleaned = cleaned.trim();
        if (cleaned) out.push(cleaned);
      });
    });
    return out;
  }

  function weakSentence(sentence) {
    if (sentence.length < 12) return true;
    if (/^https?:\/\/\S+$/i.test(sentence)) return true;
    if (/:\s*$/.test(sentence) && sentence.length < 32) return true;
    return false;
  }

  function baitSentence(sentence) {
    if (shouting(sentence)) return true;
    var t = sentence.replace(/[#@!]+/g, " ").replace(/\s+/g, " ").trim();
    return /^(new grok bot\b|holy\b|wtf\b|this is an actual\b|stop micromanaging\b|d\*mn\b|damn\b|it shouldn.?t be possible\b)/i.test(t);
  }

  function displayTitleFrom(sentence) {
    var raw = oneLine(sentence);
    if (!raw || isMachineLabel(raw)) return raw;
    var stripped = raw.replace(/[#@!！]+/g, " ").replace(/\s+/g, " ").trim();
    stripped = stripped.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "").trim();
    if (!stripped) stripped = raw.replace(/[!！]+/g, "").trim();
    if (!shouting(raw)) {
      return leadCapital(stripped).replace(/\bgrok\s+bot\b/gi, "Grok Bot");
    }
    var lower = stripped.toLowerCase();
    lower = lower.replace(/^[a-z]/, function (ch) { return ch.toUpperCase(); });
    lower = lower.replace(/([.]\s+)([a-z])/g, function (_, gap, letter) { return gap + letter.toUpperCase(); });
    lower = lower.replace(/\bi\b/g, "I");
    var keep = {
      php: "PHP", fbi: "FBI", cve: "CVE", ai: "AI", api: "API", seo: "SEO", aeo: "AEO",
      qa: "QA", ui: "UI", ux: "UX", url: "URL", id: "ID", json: "JSON", mcp: "MCP",
      cli: "CLI", css: "CSS", html: "HTML", sql: "SQL", xrpl: "XRPL", dex: "DEX",
      ios: "iOS", pdf: "PDF", csv: "CSV", sdk: "SDK", ssh: "SSH", gpu: "GPU",
      cpu: "CPU", qr: "QR", faq: "FAQ", llm: "LLM", ip: "IP", gpt: "GPT",
      yaml: "YAML", http: "HTTP", rest: "REST", dom: "DOM"
    };
    lower = lower.replace(/[A-Za-z][A-Za-z0-9+#]*/g, function (word) {
      return keep[word.toLowerCase()] || word;
    });
    return lower.replace(/\bgrok\s+bot\b/gi, "Grok Bot").replace(/\s+/g, " ").trim();
  }

  function firstJobSentence(text) {
    var parts = splitSentences(text);
    var i;
    for (i = 0; i < parts.length; i++) {
      if (weakSentence(parts[i]) || isFieldDump(parts[i]) || baitSentence(parts[i])) continue;
      return parts[i];
    }
    for (i = 0; i < parts.length; i++) {
      if (!weakSentence(parts[i]) && !isFieldDump(parts[i])) return parts[i];
    }
    return parts[0] || "";
  }

  function procedureRecord(entry) {
    var kind = recordOf(entry).kind;
    return entry.type === "workflows" || entry.type === "threads" || kind === "workflow" || kind === "install";
  }

  function titleSource(entry) {
    var rec = recordOf(entry);
    if (entry.type === "skill") return stringField(entry.description) || stringField(entry.text);
    var prompt = stringField(rec.prompt) || promptsJoined(rec);
    if (prompt) return prompt;
    var job = stringField(rec.job);
    if (job) return job;
    if (stepsJoined(rec) && (procedureRecord(entry) || entry.type === "tutorials")) return stepsJoined(rec);
    var instruction = stringField(rec.instruction);
    if (instruction) {
      var first = splitSentences(instruction)[0] || instruction;
      if (!shouting(first) && !baitSentence(first)) return instruction;
    }
    return "";
  }

  function displayTitle(entry) {
    if (verbatimSurface(entry)) return plainTitle(entry);
    var source = titleSource(entry);
    var sentence = source ? firstJobSentence(source) : "";
    if (!sentence) {
      var rec = recordOf(entry);
      var prose = [entry.description, rec.text, rec.post_text, rec.article_body, entry.text];
      for (var i = 0; i < prose.length; i++) {
        if (!prose[i] || isFieldDump(prose[i])) continue;
        sentence = firstJobSentence(prose[i]);
        if (sentence) break;
      }
    }
    if (sentence) return asSentence(displayTitleFrom(sentence));
    var fallback = plainTitle(entry);
    if (!fallback) return entry.path || "";
    if (isMachineLabel(fallback) || isFieldDump(fallback)) return oneLine(fallback);
    if (shouting(fallback) || /[#@!]/.test(fallback)) return asSentence(displayTitleFrom(fallback));
    return oneLine(fallback);
  }

  function leadCapital(text) {
    var line = oneLine(text);
    var acronyms = { php: "PHP", fbi: "FBI", cve: "CVE", ai: "AI", api: "API", url: "URL", ui: "UI", id: "ID", json: "JSON", html: "HTML", css: "CSS", sql: "SQL", qa: "QA" };
    var match = line.match(/^[a-z][a-z0-9+#]*/);
    if (match && acronyms[match[0]]) return acronyms[match[0]] + line.slice(match[0].length);
    return line.replace(/^[a-z]/, function (ch) { return ch.toUpperCase(); });
  }

  function asSentence(text) {
    var line = oneLine(text);
    if (!line || isFieldDump(line) || isMachineLabel(line)) return line;
    line = line.replace(/[:;]\s*$/, "");
    if (!/[.!?…]$/.test(line)) line += ".";
    return line;
  }

  function sameSentence(a, b) {
    function key(value) {
      return oneLine(value).toLowerCase().replace(/[#@!！]+/g, "").replace(/[:;.…]+$/g, "").replace(/\s+/g, " ").trim();
    }
    return key(a) === key(b);
  }

  function calmDescription(entry, title) {
    if (verbatimSurface(entry)) {
      var line = String(entry.description || "").split(/\r?\n/)[0].trim();
      if (!line || oneLine(line).toLowerCase() === oneLine(title).toLowerCase()) return "";
      return line;
    }
    var rec = recordOf(entry);
    var pools = [entry.description, rec.job, rec.prompt, promptsJoined(rec), rec.instruction, stepsJoined(rec), rec.text, entry.text];
    var fallback = "";
    for (var p = 0; p < pools.length; p++) {
      if (!pools[p]) continue;
      if (isFieldDump(pools[p])) {
        if (!fallback) fallback = oneLine(pools[p]);
        continue;
      }
      var parts = splitSentences(pools[p]);
      for (var i = 0; i < parts.length; i++) {
        var sentence = parts[i];
        if (weakSentence(sentence) || isFieldDump(sentence)) continue;
        if (!fallback) fallback = sentence;
        if (title && sameSentence(sentence, title)) continue;
        if (baitSentence(sentence) || /!/.test(sentence)) continue;
        return asSentence(leadCapital(sentence));
      }
    }
    if (!fallback) return "";
    if (title && sameSentence(fallback, title)) return "";
    if (isFieldDump(fallback)) return oneLine(fallback);
    if (shouting(fallback) || baitSentence(fallback)) return asSentence(displayTitleFrom(fallback));
    return asSentence(leadCapital(fallback));
  }

  function copySource(entry) {
    var rec = recordOf(entry);
    var prompt = stringField(rec.prompt);
    var prompts = promptsJoined(rec);
    if (prompt && prompts) {
      if (prompts.indexOf(prompt) !== -1 && prompts.length >= prompt.length) prompt = prompts;
      else if (prompt.indexOf(prompts) === -1) prompt = prompt + "\n\n" + prompts;
    } else if (!prompt) prompt = prompts;
    var job = stringField(rec.job);
    var primary = prompt;
    if (!primary) primary = job;
    else if (job && prompt.indexOf(job) === -1 && job.indexOf(prompt) !== -1) primary = job;
    if (entry.type === "tutorials") {
      var tutorial = stringField(rec.text) || stringField(entry.text);
      if (tutorial) return tutorial;
    }
    if (entry.type === "skill" && entry.text && !primary) return String(entry.text);
    var steps = stepsJoined(rec);
    if (steps && procedureRecord(entry)) {
      if (!primary) {
        var lead = stringField(rec.instruction);
        if (lead && !shouting(lead) && steps.indexOf(lead) === -1) return lead + "\n\n" + steps;
        return steps;
      }
      if (primary.indexOf(steps) === -1 && steps.indexOf(primary) === -1) return primary + "\n\n" + steps;
    }
    if (primary) return primary;
    if (steps && (rec.kind === "install" || entry.type === "tutorials")) return steps;
    var instruction = stringField(rec.instruction);
    if (instruction && (rec.kind === "prompt" || rec.kind === "workflow" || rec.kind === "install" || entry.type === "prompts")) {
      return instruction;
    }
    return "";
  }

  function pasteText(entry) {
    var instruction = copySource(entry);
    if (instruction) return instruction;
    var rec = recordOf(entry);
    var body = rec.prompt || rec.job || rec.text || rec.article_body || rec.post_text || "";
    if (!body && Array.isArray(rec.steps)) body = rec.steps.join("\n");
    if (!body && rec.instruction) body = rec.instruction;
    if (!body) body = entry.description || entry.name || "";
    return String(body);
  }

  function yamlQuote(value) {
    return "\"" + String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, " ") + "\"";
  }

  function skillMarkdown(entry, shown) {
    var rec = recordOf(entry);
    var title = displayTitle(entry) || "Skill";
    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "skill";
    var description = calmDescription(entry, "") || title;
    var lines = ["---", "name: " + slug, "description: " + yamlQuote(description), "---", "", shown || pasteText(entry)];
    if (Array.isArray(rec.never) && rec.never.length) {
      lines.push("", "## Do not");
      rec.never.forEach(function (item) {
        lines.push("- " + String(item));
      });
    }
    lines.push("", "Pointer: " + entry.path);
    return lines.join("\n");
  }

  function renderActions(entry, shown) {
    var text = shown || pasteText(entry);
    var wrap = document.createElement("div");
    wrap.className = "paste-actions";
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ipb-btn-primary";
    copy.textContent = "Copy prompt";
    var save = document.createElement("button");
    save.type = "button";
    save.className = "ipb-btn-secondary";
    save.textContent = "Save as skill.md";
    var status = document.createElement("p");
    status.className = "paste-status";
    status.hidden = true;
    copy.addEventListener("click", function () {
      function done(message) {
        status.hidden = false;
        status.textContent = message;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          done("Copied.");
        }, function () {
          done("Select the text in the block and copy it.");
        });
      } else {
        done("Select the text in the block and copy it.");
      }
    });
    save.addEventListener("click", function () {
      var blob = new Blob([skillMarkdown(entry, text)], { type: "text/markdown" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "skill.md";
      link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
      status.hidden = false;
      status.textContent = "Saved skill.md.";
    });
    wrap.append(copy, save, status);
    return wrap;
  }

  function renderPaste(entry, shown) {
    var text = shown || pasteText(entry);
    var block = document.createElement("pre");
    block.className = "term";
    block.textContent = text;
    var holder = document.createElement("div");
    holder.className = "paste-block";
    holder.append(block, renderActions(entry, text));
    return holder;
  }

  function renderDetail(path) {
    detailEl.replaceChildren();
    var back = document.createElement("a");
    back.className = "back";
    back.href = "#/";
    back.textContent = "All records";
    detailEl.append(back);

    var entry = byPath.get(path);
    if (!entry) {
      var missing = document.createElement("p");
      missing.className = "missing";
      missing.textContent = "No catalog entry for this path.";
      var shown = document.createElement("p");
      shown.className = "detail-path mono";
      shown.textContent = path;
      detailEl.append(missing, shown);
      document.title = "Missing record · Grokbot dataset";
      return;
    }

    var titleText = displayTitle(entry);
    var tab = titleText.length > 80 ? titleText.slice(0, 80) + "…" : titleText;
    document.title = tab + " · Grokbot dataset";

    var headingRow = document.createElement("div");
    headingRow.className = "detail-mark";
    var heading = document.createElement("h2");
    heading.textContent = titleText;
    headingRow.append(staffCard(staffId(entry), "detail"), heading);
    detailEl.append(headingRow);

    var sentence = calmDescription(entry, titleText);
    if (sentence) {
      var desc = document.createElement("p");
      desc.className = "detail-desc";
      desc.textContent = sentence;
      detailEl.append(desc);
    }

    var instruction = copySource(entry);
    var parts = readingParts(entry).filter(function (part) {
      return part && part !== instruction;
    });
    if (parts.length) {
      var textHeading = document.createElement("h3");
      textHeading.textContent = "Text";
      detailEl.append(textHeading);
      parts.forEach(function (part) {
        var textBody = document.createElement("p");
        textBody.className = "detail-prose";
        textBody.textContent = part;
        detailEl.append(textBody);
      });
    }

    if (instruction) {
      var promptHeading = document.createElement("h3");
      promptHeading.textContent = "Prompt";
      detailEl.append(promptHeading, renderPaste(entry, instruction));
    } else if (parts.length) {
      detailEl.append(renderActions(entry, parts.join("\n\n")));
    }

    if (entry.record !== undefined && entry.record !== null && typeof entry.record === "object") {
      var fieldsHeading = document.createElement("h3");
      fieldsHeading.textContent = "Record fields";
      detailEl.append(fieldsHeading, renderFields(entry.record, 0));
    } else if (entry.record !== undefined) {
      var primitiveHeading = document.createElement("h3");
      primitiveHeading.textContent = "Record fields";
      detailEl.append(primitiveHeading, fieldRow("value", entry.record, 0));
    }
  }

  function show(view) {
    var onDetail = view === "detail";
    detailSection.hidden = !onDetail;
    catalogEl.hidden = onDetail;
  }

  function route() {
    var hash = location.hash || "#/";
    if (hash.indexOf("#/file/") === 0) {
      var path = hash.slice("#/file/".length);
      try {
        path = decodeURIComponent(path);
      } catch (error) {
        path = hash.slice("#/file/".length);
      }
      show("detail");
      renderDetail(path);
      return;
    }
    document.title = "Grokbot dataset";
    show("catalog");
    renderList();
  }

  document.getElementById("filters").addEventListener("submit", function (event) {
    event.preventDefault();
  });

  function onFilter() {
    page = 1;
    if ((location.hash || "").indexOf("#/file/") === 0) {
      location.hash = "#/";
      return;
    }
    renderList();
  }

  document.getElementById("q").addEventListener("input", onFilter);
  typeSelect.addEventListener("change", onFilter);
  placeSelect.addEventListener("change", onFilter);
  sourceSelect.addEventListener("change", onFilter);
  window.addEventListener("hashchange", route);
  route();
})();
