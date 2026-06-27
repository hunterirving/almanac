"use strict";

// nth weekday of a month. n = 1..5 ("first".."fifth"), n = -1 ("last").
// weekday: 0 = Sun .. 6 = Sat. month: 0-indexed.
function nthWeekday(year, month, weekday, n) {
	if (n > 0) {
		const first = new Date(year, month, 1);
		const offset = (weekday - first.getDay() + 7) % 7;
		return new Date(year, month, 1 + offset + (n - 1) * 7);
	}
	const last = new Date(year, month + 1, 0);
	const offset = (last.getDay() - weekday + 7) % 7;
	return new Date(year, month, last.getDate() - offset);
}

// Every occurrence of a weekday within a given month.
function everyWeekdayInMonth(year, month, weekday) {
	const days = [];
	const last = new Date(year, month + 1, 0).getDate();
	let first = new Date(year, month, 1);
	let firstDate = 1 + ((weekday - first.getDay() + 7) % 7);
	for (let d = firstDate; d <= last; d += 7) days.push(new Date(year, month, d));
	return days;
}

// Every occurrence of a weekday across the whole year (K.K. Slider visits).
function everyWeekdayInYear(year, weekday) {
	const days = [];
	let d = new Date(year, 0, 1);
	d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
	while (d.getFullYear() === year) { days.push(new Date(d)); d.setDate(d.getDate() + 7); }
	return days;
}

// Day after the first Monday of a month (Mayor's Day).
function dayAfterFirstMonday(year, month) {
	const m = nthWeekday(year, month, 1, 1);
	return new Date(year, month, m.getDate() + 1);
}

// Last calendar day of each month (Raffle).
function lastDaysOfMonths(year) {
	const out = [];
	for (let m = 0; m < 12; m++) out.push(new Date(year, m + 1, 0));
	return out;
}

const EQUINOX = {
	2002: [21, 23], 2003: [21, 23], 2004: [20, 23], 2005: [20, 23], 2006: [21, 23],
	2007: [21, 23], 2008: [20, 23], 2009: [20, 23], 2010: [21, 23], 2011: [21, 23],
	2012: [20, 22], 2013: [20, 23], 2014: [21, 23], 2015: [21, 23], 2016: [20, 22],
	2017: [20, 23], 2018: [21, 23], 2019: [21, 23], 2020: [20, 22], 2021: [20, 23],
	2022: [21, 23], 2023: [21, 23], 2024: [20, 22], 2025: [20, 23], 2026: [20, 23],
	2027: [21, 23], 2028: [20, 22], 2029: [20, 23], 2030: [20, 23]
};

const HARVEST_MOON = {
	2002: [9, 15], 2003: [9, 10], 2004: [9, 28], 2005: [9, 18], 2006: [10, 7],
	2007: [9, 26], 2008: [9, 15], 2009: [10, 4], 2010: [9, 23], 2011: [9, 12],
	2012: [9, 30], 2013: [9, 19], 2014: [9, 9], 2015: [9, 28], 2016: [9, 16],
	2017: [10, 5], 2018: [9, 25], 2019: [9, 14], 2020: [10, 1], 2021: [9, 20],
	2022: [9, 10], 2023: [9, 29], 2024: [9, 18], 2025: [10, 7], 2026: [9, 26],
	2027: [9, 15], 2028: [10, 3], 2029: [9, 22], 2030: [9, 13]
};

// Clamp to the table's range; past 2030 the game's calendar freezes on 2030.
function tableYear(year) { return year < 2002 ? 2002 : year > 2030 ? 2030 : year; }

function equinoxDate(year, which) {
	const e = EQUINOX[tableYear(year)];
	return new Date(year, which === "spring" ? 2 : 8, which === "spring" ? e[0] : e[1]);
}

function autumnMoonDate(year) {
	const hm = HARVEST_MOON[tableYear(year)];
	return new Date(year, hm[0] - 1, hm[1]);
}

function fixed(y, m, d) { return { start: new Date(y, m, d), end: new Date(y, m, d) }; }
function range(y, m1, d1, m2, d2) { return { start: new Date(y, m1, d1), end: new Date(y, m2, d2) }; }
function single(date) { return { start: date, end: date }; }

function dateForYear(rule, y) {
	switch (rule.type) {
		case "fixed": return fixed(y, rule.month - 1, rule.day);
		case "range": return range(y, rule.startMonth - 1, rule.startDay, rule.endMonth - 1, rule.endDay);
		case "nthWeekday": return single(nthWeekday(y, rule.month - 1, rule.weekday, rule.n));
		case "weeklyInMonth": return { multi: everyWeekdayInMonth(y, rule.month - 1, rule.weekday) };
		case "weekly": return { multi: everyWeekdayInYear(y, rule.weekday) };
		case "equinox": return single(equinoxDate(y, rule.which));
		case "autumnMoon": return single(autumnMoonDate(y));
		case "dayAfterFirstMonday": return single(dayAfterFirstMonday(y, rule.month - 1));
		case "dayAfterNthWeekday": return single(addDays(nthWeekday(y, rule.month - 1, rule.weekday, rule.n), 1));
		case "lastDayOfMonth": return { multi: lastDaysOfMonths(y) };
		case "randomInMonth": {
			if (townDay) return fixed(y, rule.month - 1, townDay);
			// default to month-end while unknown so it sorts last and resists scrolling off-top
			const d = new Date(y, rule.month - 1, 31); return { start: d, end: d, unknownDay: true };
		}
		default: return null;
	}
}

let EVENTS = [];

let VILLAGERS = [];

const STORE_KEY = "almanac.villagers.v1";
let chosenIds = [];
function loadChosen() {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (raw) chosenIds = JSON.parse(raw);
	} catch (e) { /* memory only */ }
}
function saveChosen() {
	try { localStorage.setItem(STORE_KEY, JSON.stringify(chosenIds)); } catch (e) {}
}

// Hometown's date is randomized per save file; let the user pin it to any* day in July.
// July 4 is taken by the Fireworks Show. Persisted as a 1-31 day number.
const TOWN_DAY_KEY = "almanac.townDay.v1";
let townDay = null;
function validTownDay(n) { return Number.isInteger(n) && n >= 1 && n <= 31 && n !== 4; }
function loadTownDay() {
	try {
		const n = parseInt(localStorage.getItem(TOWN_DAY_KEY), 10);
		if (validTownDay(n)) townDay = n;
	} catch (e) { /* memory only */ }
}
function saveTownDay() {
	try { localStorage.setItem(TOWN_DAY_KEY, String(townDay)); } catch (e) {}
}

const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_MS = 86400000;
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

// Times in events.json are structured: { start, end } 24h "HH:MM" (end optional,
// and may wrap past midnight), { allDay: true }, or { text } for non-clock labels.
function parseHM(s) { const p = s.split(":"); return [parseInt(p[0], 10), parseInt(p[1], 10)]; }
// Reproduce the original display strings: a shared meridiem shows only on the end
// ("6–9 PM"), minutes appear on both ends when either is off the hour ("8:00–9:15 AM").
function clockLabel(h, m, showMin, showMer) {
	const mer = h < 12 ? "AM" : "PM";
	const hr = (h % 12) || 12;
	let s = String(hr);
	if (showMin) s += ":" + String(m).padStart(2, "0");
	if (showMer) s += " " + mer;
	return s;
}
// Sat/Sun shorthand used by weekend-spanning events (Tent Campers).
const WEEKDAY_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_FULL = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
const WEEKDAY_ICS = { Sun: "SU", Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA" };
const ICS_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // indexed by getDay()

// Minute-of-day an event starts, for same-day ordering. All-day, free-text, and
// untimed items return -1 so they sort ahead of clock-timed ones.
function startMinutes(ev) {
	const t = ev.time;
	if (!t || !t.start || t.allDay || t.text) return -1;
	const [h, m] = parseHM(t.start);
	return h * 60 + m;
}

function formatTime(time) {
	if (!time) return "";
	if (time.text) return time.text;
	if (time.allDay) return "All day";
	if (!time.start) return "";
	const [sh, sm] = parseHM(time.start);
	if (!time.end) return clockLabel(sh, sm, sm !== 0, true);
	const [eh, em] = parseHM(time.end);
	const showMin = sm !== 0 || em !== 0;
	// A run that spans named weekdays (e.g. Sat morning to Sun afternoon): label each end.
	if (time.startDay) {
		return clockLabel(sh, sm, showMin, true) + " " + WEEKDAY_FULL[time.startDay] +
			" – " + clockLabel(eh, em, showMin, true) + " " + WEEKDAY_FULL[time.endDay];
	}
	const sameMer = (sh < 12) === (eh < 12);
	return clockLabel(sh, sm, showMin, !sameMer) + "–" + clockLabel(eh, em, showMin, true);
}

function rangeLabel(start, end) {
	if (start.getTime() === end.getTime()) return MONTH_FULL[start.getMonth()] + " " + start.getDate();
	if (start.getMonth() === end.getMonth()) return MONTH_FULL[start.getMonth()] + " " + start.getDate() + "\u2013" + end.getDate();
	return MONTH_FULL[start.getMonth()] + " " + start.getDate() + " \u2013 " + MONTH_FULL[end.getMonth()] + " " + end.getDate();
}
function daysBetween(target, today) { return Math.round((startOfDay(target) - startOfDay(today)) / DAY_MS); }

function awayLabel(start, end, today) {
	const t = startOfDay(today);
	if (t >= startOfDay(start) && t <= startOfDay(end)) return "Today!";
	const d = daysBetween(start, today);
	if (d === 1) return "Tomorrow";
	if (d < 7) return "in " + d + " days";
	if (d < 14) return "in 1 week";
	if (d < 60) return "in " + Math.round(d / 7) + " weeks";
	if (d < 365) return "in " + Math.round(d / 30) + " months";
	return "in 1 year";
}

// Is the event happening right now? For weekend-only events (Tent Campers) this
// is true only on Saturdays and Sundays within the run, not every day of it.
function isActiveToday(ev, today) {
	if (ev.unknownDay) return false;
	const t = startOfDay(today);
	if (t < startOfDay(ev.start) || t > startOfDay(ev.end)) return false;
	if (ev.weekendsOnly && t.getDay() !== 0 && t.getDay() !== 6) return false;
	return true;
}

// Relative label for an event that is NOT active today.
function awayFor(ev, today) {
	if (ev.unknownDay) {
		const sameMonth = ev.start.getFullYear() === today.getFullYear() && ev.start.getMonth() === today.getMonth();
		return sameMonth ? "This month" : "in " + MONTH_FULL[ev.start.getMonth()];
	}
	const t = startOfDay(today);
	// Mid-run on an off day (e.g. a weekday during Tent Campers): point to the weekend.
	if (t >= startOfDay(ev.start) && t <= startOfDay(ev.end)) return "This weekend";
	return awayLabel(ev.start, ev.end, today);
}

// Date for the chip: the soonest day the event actually happens on or after today.
// A run already underway rolls forward from its past start (weekend-only runs skip
// to the next Sat/Sun) instead of stranding the chip on the start date.
function chipDate(ev, today) {
	const t = startOfDay(today);
	if (startOfDay(ev.start) >= t) return ev.start; // upcoming or single-day — as-is
	let d = t;
	if (ev.weekendsOnly) while (d.getDay() !== 0 && d.getDay() !== 6) d = addDays(d, 1);
	return d > startOfDay(ev.end) ? ev.start : d;
}

// Window: from today up to (but not beyond) one year out.
function buildSchedule(today) {
	const t = startOfDay(today);
	const horizon = addDays(t, 365); // strictly within a year
	const years = [today.getFullYear(), today.getFullYear() + 1];
	const items = [];

	function consider(occ, meta) {
		const startDay = startOfDay(occ.start);
		const endDay = startOfDay(occ.end);
		// keep if currently running or upcoming, and it starts before the 1-year horizon
		if (endDay >= t && startDay < horizon) {
			items.push(Object.assign({ start: occ.start, end: occ.end, unknownDay: !!occ.unknownDay }, meta));
		}
	}

	for (const def of EVENTS) {
		const editable = def.date.type === "randomInMonth";
		const note = editable && townDay ? MONTH_FULL[def.date.month - 1] + " " + townDay : def.note;
		const meta = { kind: "event", name: def.name, note, desc: def.desc, time: def.time, weekendsOnly: def.weekendsOnly, editable, recurringWeekly: def.date.type === "weekly" };
		// A year-round weekly event would flood the list with one card per week;
		// collapse it to a single card for the next upcoming occurrence.
		if (def.date.type === "weekly") {
			let next = null;
			for (const y of years) {
				const occ = dateForYear(def.date, y).multi.find(dt => startOfDay(dt) >= t);
				if (occ) { next = occ; break; }
			}
			if (next) consider({ start: next, end: next }, meta);
			continue;
		}
		for (const y of years) {
			const r = dateForYear(def.date, y);
			if (!r) continue;
			if (r.multi) {
				r.multi.forEach(dt => consider({ start: dt, end: dt }, meta));
			} else {
				consider(r, meta);
			}
		}
	}

	// Villager birthdays
	const chosen = VILLAGERS.filter(v => chosenIds.includes(v.name));
	for (const v of chosen) {
		for (const y of years) {
			const dt = new Date(y, v.m - 1, v.d);
			consider({ start: dt, end: dt }, {
				kind: "birthday",
				name: birthdayName(v.name),
				note: "",
				desc: "",
				villager: v
			});
		}
	}

	items.sort((a, b) => startOfDay(a.start) - startOfDay(b.start)
		|| (a.kind === "birthday" ? 1 : 0) - (b.kind === "birthday" ? 1 : 0)
		|| startMinutes(a) - startMinutes(b)
		|| a.name.localeCompare(b.name));

	// De-dupe identical occurrences (same name + same start day) that can arise
	// from the two-year scan overlapping at the horizon.
	const seen = new Set();
	return items.filter(it => {
		const key = it.kind + "|" + it.name + "|" + startOfDay(it.start).getTime();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Possessive birthday title: "Bob's Birthday", but "Puddles' Birthday" for names ending in s.
function birthdayName(name) { return name + (/s$/i.test(name) ? "\u2019" : "\u2019s") + " Birthday"; }

const IMG_BASE = "resources/images/villagers/";
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function villagerImg(v) { return IMG_BASE + slug(v.name) + ".webp"; }

let firstPaint = true;
let expandedKey = null; // which card is expanded in place
let currentSchedule = [];

function itemKey(it) { return it.kind + "|" + it.name + "|" + startOfDay(it.start).getTime(); }

function render() {
	const today = new Date();
	currentSchedule = buildSchedule(today);

	// Drop the expanded card if it no longer exists (e.g. a birthday was removed).
	if (expandedKey && !currentSchedule.some(it => itemKey(it) === expandedKey)) {
		expandedKey = null;
	}

	const list = document.getElementById("list");
	list.innerHTML = "";
	currentSchedule.forEach((ev, i) => {
		const key = itemKey(ev);
		const li = document.createElement("div");
		li.setAttribute("role", "button");
		li.tabIndex = 0;
		li.className = "event" + (ev.kind === "birthday" ? " birthday" : "");
		if (key === expandedKey) li.classList.add("expanded");
		li.setAttribute("aria-expanded", String(key === expandedKey));
		// Animate only on first paint so toggling villagers doesn't reflow-flash.
		if (firstPaint) li.style.animationDelay = Math.min(i * 0.025, 0.5) + "s";
		else li.style.animation = "none";

		const head = document.createElement("div");
		head.className = "event-head";

		const chip = document.createElement("div");
		chip.className = "chip";
		const cd = chipDate(ev, today);
		chip.innerHTML = '<span class="mon">' + MON[cd.getMonth()] + '</span>' +
			'<span class="day">' + (ev.unknownDay ? "?" : cd.getDate()) + '</span>';

		const active = isActiveToday(ev, today);

		const mid = document.createElement("div");
		const nameDiv = document.createElement("div");
		nameDiv.className = "name";
		nameDiv.textContent = ev.name + (ev.kind === "birthday" ? " \uD83C\uDF82" : "");
		mid.appendChild(nameDiv);
		const timeStr = formatTime(ev.time);
		if (ev.note || timeStr) {
			const subDiv = document.createElement("div");
			subDiv.className = "sub";
			[ev.note, timeStr].filter(Boolean).forEach((line, i) => {
				if (i > 0) subDiv.appendChild(document.createElement("br"));
				subDiv.appendChild(document.createTextNode(line));
			});
			mid.appendChild(subDiv);
		}

		const away = document.createElement("div");
		away.className = "away";
		away.textContent = active ? "Today" : awayFor(ev, today);

		head.appendChild(chip); head.appendChild(mid); head.appendChild(away);

		// The detail that used to live in the hero card, revealed in place.
		const detail = document.createElement("div");
		detail.className = "event-detail";
		const inner = document.createElement("div");
		inner.className = "ed-inner";
		const edBody = document.createElement("div");
		edBody.className = "ed-body";
		edBody.innerHTML = detailHtml(ev);
		appendCalChip(edBody, ev);
		inner.appendChild(edBody);
		detail.appendChild(inner);

		li.appendChild(head); li.appendChild(detail);
		li.addEventListener("click", () => toggleExpand(key));
		li.addEventListener("keydown", e => {
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(key); }
		});
		list.appendChild(li);
	});

	firstPaint = false;
}

// Native date input, constrained to July (July 4 belongs to the Fireworks Show),
// overlaid on the "Set date" chip.
function townDayInput() {
	const pad = n => String(n).padStart(2, "0");
	// the most nearly upcoming July: this year through July, next year once it's passed
	const now = new Date();
	const year = now.getMonth() > 6 ? now.getFullYear() + 1 : now.getFullYear();
	const input = document.createElement("input");
	input.type = "date";
	input.className = "town-day-input";
	input.min = year + "-07-01";
	input.max = year + "-07-31";
	// prefill so the wheel opens inside July (today is out of range and would
	// otherwise leave it stuck); default to the 31st while still unknown
	const defaultValue = () => year + "-07-" + pad(townDay || 31);
	input.value = defaultValue();
	input.setAttribute("aria-label", "Set Town Day");

	// Commit on close too, not just change: picking the already-shown day (e.g. 31)
	// fires no change event, so reading the value on blur lets that selection stick.
	// change and blur both fire per interaction, so skip a value we've already handled
	// to avoid duplicate alerts (e.g. two July-4th popups).
	let handled = null;
	const commit = () => {
		if (!input.value || input.value === handled) return;
		handled = input.value;
		const [y, m, d] = input.value.split("-").map(Number);
		if (y !== year) { alert("Please pick a day in July " + year + "."); return; }
		if (m !== 7) { alert("Hometown Day always falls in July. Please pick a day in July."); return; }
		if (d === 4) { alert("Hometown Day can't fall on July 4th, as it would overlap with the Fireworks Show. Please pick another day in July."); return; }
		if (!validTownDay(d) || d === townDay) return;
		townDay = d;
		saveTownDay();
		render();
	};
	// reopen always lands on July of the current year, discarding a prior bad pick
	input.addEventListener("focus", () => { input.value = defaultValue(); handled = null; });
	// desktop (Firefox/Chrome) won't open the picker from a click on an appearance:none
	// field; showPicker() does. iOS <16 falls back to the native tap-to-open.
	input.addEventListener("click", e => {
		e.stopPropagation();
		if (input.showPicker) { try { input.showPicker(); } catch (err) {} }
	});
	input.addEventListener("change", commit);
	input.addEventListener("blur", commit);
	return input;
}

function toggleExpand(key) {
	expandedKey = (expandedKey === key) ? null : key;
	const buttons = document.getElementById("list").querySelectorAll(".event");
	currentSchedule.forEach((ev, i) => {
		if (!buttons[i]) return;
		const on = itemKey(ev) === expandedKey;
		buttons[i].classList.toggle("expanded", on);
		buttons[i].setAttribute("aria-expanded", String(on));
	});
}

// Hidden content for a card: the description for events, portrait + quote for
// birthdays. The date and countdown already live in the card header.
function detailHtml(ev) {
	if (ev.kind === "birthday" && ev.villager) {
		const v = ev.villager;
		let html = '<div class="bday-portrait"><img src="' + villagerImg(v) + '" alt="' + escapeHtml(v.name) + '" ' +
			'onerror="this.style.display=\'none\'"></div>';
		if (v.quote) html += '<div class="vquote"><span class="mark">\u201c</span>' + escapeHtml(v.quote) + '<span class="mark">\u201d</span></div>';
		return html;
	}
	return ev.desc ? '<div class="d-desc">' + escapeHtml(ev.desc) + '</div>' : "";
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// A leaf/pink "Add to Calendar" chip styled like the villager-remove tag.
// For birthdays it sits below the quote (centered within the text column); for
// events, centered below the description.
function appendCalChip(edBody, ev) {
	const wrap = document.createElement("div");
	wrap.className = "cal-wrap";

	if (ev.editable && ev.unknownDay) {
		// Hometown Day with no date yet: pick a date here instead of a calendar export.
		const set = document.createElement("div");
		set.className = "cal-tag set-date";
		set.setAttribute("aria-label", "Set " + ev.name + " date");
		set.appendChild(document.createTextNode("Set date"));
		set.appendChild(townDayInput());
		wrap.appendChild(set);
	} else {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "cal-tag";
		btn.setAttribute("aria-label", "Add " + ev.name + " to calendar");
		btn.textContent = "Add to Calendar";
		btn.addEventListener("click", e => { e.stopPropagation(); downloadICS(ev); });
		wrap.appendChild(btn);

		// Hometown Day with a date set: keep a way to change it alongside the export.
		if (ev.editable) {
			wrap.classList.add("cal-wrap--multi");
			const change = document.createElement("div");
			change.className = "cal-tag set-date";
			change.setAttribute("aria-label", "Change " + ev.name + " date");
			change.appendChild(document.createTextNode("Change date"));
			change.appendChild(townDayInput());
			wrap.appendChild(change);
		}
	}

	if (ev.kind === "birthday") {
		let q = edBody.querySelector(".vquote");
		if (!q) { q = document.createElement("div"); q.className = "vquote"; edBody.appendChild(q); }
		q.appendChild(wrap);
	} else {
		edBody.appendChild(wrap);
	}
}

function pad2(n) { return String(n).padStart(2, "0"); }
function atTime(d, h, m) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m); }
function icsDate(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
function icsLocal(d) { return icsDate(d) + "T" + pad2(d.getHours()) + pad2(d.getMinutes()) + "00"; }
function icsStamp(d) {
	return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) +
		"T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
}
function icsEscape(s) {
	return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// Fold to <=75 octets per RFC 5545, counting UTF-8 bytes and never splitting a char.
function icsFold(line) {
	let out = "", run = 0;
	for (const ch of line) {
		const bytes = encodeURIComponent(ch).replace(/%[0-9A-F]{2}/gi, "x").length;
		if (run + bytes > 75) { out += "\r\n "; run = 1; }
		out += ch;
		run += bytes;
	}
	return out;
}

// Resolve an item to concrete calendar datetimes. Single-day timed events become a
// timed VEVENT (end wraps to the next day when it's past midnight); everything else
// (all-day, free-text hours, or a multi-day range) becomes an all-day span.
function icsTimes(ev) {
	const sameDay = startOfDay(ev.start).getTime() === startOfDay(ev.end).getTime();
	const t = ev.time;
	if (t && t.start && !t.allDay && !t.text) {
		const [sh, sm] = parseHM(t.start);
		const [eh, em] = t.end ? parseHM(t.end) : [sh, sm];
		// A weekend-spanning event (Tent Campers: Sat morning to Sun afternoon) recurs
		// weekly on its start weekday; the run can cover more than one calendar day.
		if (t.startDay) {
			const startWd = WEEKDAY_NUM[t.startDay];
			const firstDay = startOfDay(ev.start), lastDay = startOfDay(ev.end);
			let first = firstDay;
			while (first.getDay() !== startWd) first = addDays(first, 1);
			const dayspan = (WEEKDAY_NUM[t.endDay] - startWd + 7) % 7;
			const start = atTime(first, sh, sm);
			const end = atTime(addDays(first, dayspan), eh, em);
			const until = atTime(lastDay, sh, sm);
			const yr = ev.start.getFullYear();
			const exdates = [], extras = [];
			// A weekend that collides with the Fireworks Show (Jul 4) or Meteor Shower
			// (Aug 12) loses the camper only on that day — drop the whole span from the
			// recurrence, then re-add the weekend's other (non-colliding) day on its own.
			for (const [mo, dy] of [[7, 4], [8, 12]]) {
				const c = startOfDay(new Date(yr, mo - 1, dy));
				const offset = (c.getDay() - startWd + 7) % 7;
				if (offset > dayspan) continue; // collision lands outside the weekend span
				const anchor = addDays(c, -offset);
				if (anchor < first || anchor > lastDay) continue;
				exdates.push(atTime(anchor, sh, sm));
				for (let i = 0; i <= dayspan; i++) {
					const day = addDays(anchor, i);
					if (day.getTime() !== c.getTime() && day >= firstDay && day <= lastDay) {
						extras.push({ start: atTime(day, sh, sm), end: atTime(day, eh, em) });
					}
				}
			}
			// Edge case: campers also appear on May 26 when June 1 is a Saturday.
			if (firstDay.getMonth() === 5 && firstDay.getDate() === 1 && firstDay.getDay() === startWd) {
				const may26 = addDays(firstDay, -6);
				extras.push({ start: atTime(may26, sh, sm), end: atTime(may26, eh, em) });
			}
			return { timed: true, start, end, rrule: "FREQ=WEEKLY;BYDAY=" + WEEKDAY_ICS[t.startDay] + ";UNTIL=" + icsLocal(until), exdates, extras };
		}
		const start = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate(), sh, sm);
		let end = t.end ? new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate(), eh, em) : null;
		if (end && end <= start) end = new Date(end.getTime() + DAY_MS);
		// A year-round weekly event (K.K. Slider) shows as one card but exports the
		// whole recurring series, capped a year out to mirror the on-screen horizon.
		if (ev.recurringWeekly) {
			const until = atTime(addDays(startOfDay(ev.start), 364), sh, sm);
			return { timed: true, start, end, rrule: "FREQ=WEEKLY;BYDAY=" + ICS_BYDAY[start.getDay()] + ";UNTIL=" + icsLocal(until) };
		}
		// A multi-day run with daily hours is many separate occurrences, not one
		// block: emit a daily-recurring timed event the calendar expands per day.
		const rrule = sameDay ? null : "FREQ=DAILY;UNTIL=" + icsLocal(new Date(ev.end.getFullYear(), ev.end.getMonth(), ev.end.getDate(), sh, sm));
		return { timed: true, start, end, rrule };
	}
	// All-day. A weekends-only run recurs on Sat/Sun rather than spanning weekdays.
	if (ev.weekendsOnly && !sameDay) {
		let first = startOfDay(ev.start);
		while (first.getDay() !== 0 && first.getDay() !== 6) first = addDays(first, 1);
		return { timed: false, startDate: first, endExcl: addDays(first, 1), rrule: "FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=" + icsDate(startOfDay(ev.end)) };
	}
	return { timed: false, startDate: startOfDay(ev.start), endExcl: addDays(startOfDay(ev.end), 1) };
}

function icsDescription(ev) {
	if (ev.kind === "birthday") return ev.villager && ev.villager.quote ? "“" + ev.villager.quote + "”" : "";
	let d = ev.desc || "";
	const t = ev.time;
	if (t && t.text) d += (d ? "\n\n" : "") + t.text;
	return d;
}

function buildICS(ev) {
	const tm = icsTimes(ev);
	const stamp = icsStamp(new Date());
	const baseUid = slug(ev.name) + "-" + icsDate(startOfDay(ev.start));
	const summary = icsEscape(ev.name);
	const descRaw = icsDescription(ev);
	const desc = descRaw ? icsEscape(descRaw) : "";

	const main = ["BEGIN:VEVENT", "UID:" + baseUid + "@town-almanac", "DTSTAMP:" + stamp];
	if (tm.timed) {
		main.push("DTSTART:" + icsLocal(tm.start));
		if (tm.end) main.push("DTEND:" + icsLocal(tm.end));
	} else {
		main.push("DTSTART;VALUE=DATE:" + icsDate(tm.startDate));
		main.push("DTEND;VALUE=DATE:" + icsDate(tm.endExcl));
	}
	const rrule = ev.kind === "birthday" ? "FREQ=YEARLY" : tm.rrule;
	if (rrule) main.push("RRULE:" + rrule);
	if (tm.exdates) tm.exdates.forEach(d => main.push("EXDATE:" + icsLocal(d)));
	main.push("SUMMARY:" + summary);
	if (desc) main.push("DESCRIPTION:" + desc);
	main.push("END:VEVENT");

	const events = [main];
	// Single-day occurrences pulled out of the recurrence (a collision-split weekend,
	// or the May 26 pre-season camper) ride along as their own VEVENTs.
	if (tm.extras) tm.extras.forEach(ex => {
		const v = ["BEGIN:VEVENT", "UID:" + baseUid + "-" + icsDate(startOfDay(ex.start)) + "@town-almanac",
			"DTSTAMP:" + stamp, "DTSTART:" + icsLocal(ex.start), "DTEND:" + icsLocal(ex.end), "SUMMARY:" + summary];
		if (desc) v.push("DESCRIPTION:" + desc);
		v.push("END:VEVENT");
		events.push(v);
	});

	const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Town Almanac//AC GameCube//EN", "CALSCALE:GREGORIAN"]
		.concat(...events, ["END:VCALENDAR"]);
	return lines.map(icsFold).join("\r\n") + "\r\n";
}

// Build the .ics in memory and trigger a download. On iOS, tapping the file offers
// "Add to Calendar"; desktop drops it in Downloads.
function downloadICS(ev) {
	const blob = new Blob([buildICS(ev)], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = slug(ev.name) + "-" + icsDate(startOfDay(ev.start)) + ".ics";
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

let lastQuery = null;		// tracks when results actually need a rebuild
const rowEls = new Map();	// villager name -> its result <button>

function toggleVillager(name, add) {
	if (add) {
		if (chosenIds.length < 15 && !chosenIds.includes(name)) chosenIds.push(name);
	} else {
		chosenIds = chosenIds.filter(n => n !== name);
	}
	saveChosen();
	updatePickerChrome();
	refreshResultStates();
	render();
}

// Count, limit note, and the chosen-tags row.
function updatePickerChrome() {
	document.getElementById("picker-count").textContent = chosenIds.length + "/15";

	const chosenWrap = document.getElementById("chosen");
	chosenWrap.innerHTML = "";
	chosenIds.forEach(name => {
		const v = VILLAGERS.find(x => x.name === name);
		if (!v) return;
		const tag = document.createElement("button");
		tag.className = "tag";
		tag.setAttribute("aria-label", "Remove " + v.name);
		tag.textContent = v.name + " ";
		const x = document.createElement("span");
		x.className = "tag-x";
		x.innerHTML = '<span class="tag-x-bar"></span>';
		tag.appendChild(x);
		tag.addEventListener("click", () => toggleVillager(name, false));
		chosenWrap.appendChild(tag);
	});
}

// Update only the checked/disabled appearance of existing result rows.
function refreshResultStates() {
	const atLimit = chosenIds.length >= 15;
	rowEls.forEach((btn, name) => {
		const already = chosenIds.includes(name);
		btn.disabled = !already && atLimit;
		btn.classList.toggle("chosen-row", already);
	});
}

// Full rebuild of the results list — only when the query changes.
function renderResults(query) {
	const q = (query || "").trim().toLowerCase();
	if (q === lastQuery) { refreshResultStates(); return; }
	lastQuery = q;

	const box = document.getElementById("results");
	box.innerHTML = "";
	rowEls.clear();

	let matches = VILLAGERS;
	if (q) {
		matches = VILLAGERS.filter(v =>
			v.name.toLowerCase().startsWith(q) ||
			v.species.toLowerCase().startsWith(q))
	}
	matches = matches.slice().sort((a, b) => a.name.localeCompare(b.name));

	if (matches.length === 0) {
		const e = document.createElement("div");
		e.className = "empty";
		e.textContent = "No villagers match that. Try a name like \u201cBob\u201d or a species like \u201ccat\u201d.";
		box.appendChild(e);
		return;
	}

	const atLimit = chosenIds.length >= 15;
	matches.forEach(v => {
		const already = chosenIds.includes(v.name);
		const btn = document.createElement("button");
		btn.className = "vrow" + (already ? " chosen-row" : "");
		btn.disabled = !already && atLimit;
		btn.innerHTML = '<span class="vmain"><img class="vthumb" src="' + villagerImg(v) + '" alt="" loading="lazy">' +
			'<span class="vname">' + v.name + '<span class="vcheck">\u2713</span></span></span>' +
			'<span class="meta">' + monthDay(v.m, v.d) + '</span>';
		btn.addEventListener("click", () => {
			if (chosenIds.includes(v.name)) toggleVillager(v.name, false);
			else if (chosenIds.length < 15) toggleVillager(v.name, true);
		});
		rowEls.set(v.name, btn);
		box.appendChild(btn);
	});
}

function monthDay(m, d) { return MON[m - 1].charAt(0) + MON[m - 1].slice(1).toLowerCase() + " " + d; }

loadChosen();
loadTownDay();
render();
document.getElementById("search").addEventListener("input", e => renderResults(e.target.value));

// Event list + villager roster live in resources/*.json — load both, then
// populate the schedule, picker, and birthdays.
function loadJson(url) {
	return fetch(url).then(r => r.json()).catch(() => []);
}
Promise.all([
	loadJson("resources/events.json"),
	loadJson("resources/villagers.json")
]).then(([events, villagers]) => {
	EVENTS = events;
	VILLAGERS = villagers;
}).finally(() => {
	updatePickerChrome();
	renderResults("");
	render();
});

// Collapsible villager panel
(function setupVillagerPanel() {
	const toggle = document.getElementById("villagers-toggle");
	toggle.addEventListener("click", () => {
		const open = toggle.getAttribute("aria-expanded") === "true";
		toggle.setAttribute("aria-expanded", String(!open));
	});
})();

// PWA: register the cache-first service worker
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("sw.js").catch(() => {});
	});
}
