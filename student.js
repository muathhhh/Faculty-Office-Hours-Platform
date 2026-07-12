/* ---------- Page Elements ---------- */
const facultyList = document.getElementById("facultyList");
const searchInput = document.getElementById("searchInput");
const departmentFilter = document.getElementById("departmentFilter");
const resultsCount = document.getElementById("resultsCount");
const calendarFacultySelect = document.getElementById("calendarFacultySelect");
const calendarSearchInput = document.getElementById("calendarSearchInput");
const calendarBody = document.getElementById("calendarBody");

/* ---------- Global State ---------- */
let currentUser = null;
let currentUserData = null;
let allFacultyData = [];
let facultyFuse = null;

/* ---------- Helpers ---------- */
function setText(element, message) {
  if (element) {
    element.textContent = message;
  }
}

function logout() {
  auth.signOut()
    .then(() => {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentRole");
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
      window.location.href = "login.html";
    });
}

/* ---------- Load Faculty Data ---------- */
async function loadAllFacultyData() {
  try {
    const usersSnapshot = await db
      .collection("users")
      .where("role", "==", "faculty")
      .get();

    const officeHoursSnapshot = await db.collection("officeHours").get();
    const officeHoursDocs = officeHoursSnapshot.docs.map(doc => doc.data());

    allFacultyData = [];

    usersSnapshot.forEach(doc => {
      const faculty = doc.data();

      const userOfficeHours = officeHoursDocs.filter(
        item => item.userId === doc.id
      );

      allFacultyData.push({
        uid: doc.id,
        loginEmail: faculty.email || "",
        name: faculty.name || "Unknown Faculty",
        department: faculty.department || "Unknown Department",
        contactEmail: faculty.contactEmail || "Not provided",
        officeHours: userOfficeHours
      });
    });
  } catch (error) {
    console.error("Error loading faculty data:", error);
    allFacultyData = [];
  }
}

/* ---------- Smart Search Index ---------- */
function buildFacultySearchIndex() {
  facultyFuse = new Fuse(allFacultyData, {
    includeScore: true,
    threshold: 0.25,
    ignoreLocation: false,
    minMatchCharLength: 2,
    keys: [
      { name: "name", weight: 1.0 }
    ]
  });
}

/* ---------- Render Faculty Cards ---------- */
function renderRealFacultyCards(items) {
  if (!facultyList) return;

  if (items.length === 0) {
    facultyList.innerHTML = `
      <div class="no-results">
        <h3>No faculty data found</h3>
        <p>No faculty profiles or office hours have been added yet.</p>
      </div>
    `;

    setText(resultsCount, "0 faculty member(s) found");
    return;
  }

  facultyList.innerHTML = items.map(item => {
    const availableNow = isFacultyAvailableNow(item);

    return `
    <div class="faculty-card real-faculty-card">
      <div class="faculty-top">
        <div>
          <h3 class="faculty-name">${item.name}</h3>
          <p class="faculty-department">${item.department}</p>
        </div>
        <span class="live-status-badge ${availableNow ? "is-open" : "is-closed"}">
          <span class="live-status-dot"></span>
          ${availableNow ? "Available now" : "Not available"}
        </span>
      </div>

      <div class="faculty-details">
        <div class="detail-row">
          <span class="detail-label">Contact Email:</span> ${item.contactEmail}
        </div>
        <div class="detail-row">
          <span class="detail-label">Building:</span> B13
        </div>
      </div>

      <div class="student-office-hours-list">
        <h4 class="student-office-hours-title">Office Hours</h4>
        ${
          item.officeHours.length > 0
            ? item.officeHours.map(hour => `
              <div class="student-office-hour-item${isSlotActiveNow(hour) ? " active-now" : ""}">
                <p><strong>Day:</strong> ${hour.day}${isSlotActiveNow(hour) ? ' <span class="active-now-tag">Happening now</span>' : ""}</p>
                <p><strong>Time:</strong> ${hour.time}</p>
                <p><strong>Location:</strong> ${hour.room}</p>
                ${hour.note ? `<p><strong>Note:</strong> ${hour.note}</p>` : ""}
              </div>
            `).join("")
            : `<p class="no-office-hours-text">No office hours added yet.</p>`
        }
      </div>
    </div>
  `;
  }).join("");

  setText(resultsCount, `${items.length} faculty member(s) found`);
}

/* ---------- Filter Faculty ---------- */
function filterRealFaculty() {
  if (!facultyList) return;

  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const selectedDepartment = departmentFilter ? departmentFilter.value : "all";

  let filtered = [...allFacultyData];

  if (searchValue) {
    if (searchValue.length === 1) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().startsWith(searchValue)
      );
    } else if (facultyFuse) {
      filtered = facultyFuse.search(searchValue).map(result => result.item);
    }
  }

  if (selectedDepartment !== "all") {
    filtered = filtered.filter(item => item.department === selectedDepartment);
  }

  renderRealFacultyCards(filtered);
}

/* ---------- Fill Faculty Dropdown ---------- */
function populateFacultySelect(items = allFacultyData) {
  if (!calendarFacultySelect) return;

  calendarFacultySelect.innerHTML = `
    <option value="">Select Faculty</option>
    ${items.map(faculty => `
      <option value="${faculty.uid}">${faculty.name} - ${faculty.department}</option>
    `).join("")}
  `;
}

/* ---------- Filter Calendar Faculty Dropdown ---------- */
function filterCalendarFacultySelect() {
  if (!calendarSearchInput) return;

  const value = calendarSearchInput.value.trim().toLowerCase();

  let filtered = [...allFacultyData];

  if (value) {
    if (value.length === 1) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().startsWith(value)
      );
    } else {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(value)
      );
    }
  }

  populateFacultySelect(filtered);

  if (filtered.length === 1) {
    calendarFacultySelect.value = filtered[0].uid;
    renderFacultyCalendar(filtered[0].uid);
  } else {
    calendarFacultySelect.value = "";
    renderFacultyCalendar("");
  }
}

/* ---------- Calendar Helpers ---------- */
function convertTo24(timeStr) {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours + minutes / 60;
}

/* ---------- Live Availability ---------- */

/* Returns true if `hour` (one office-hours entry) covers this exact moment */
function isSlotActiveNow(hourEntry) {
  const now = new Date();
  const currentDay = WEEKDAYS[now.getDay()];

  if (hourEntry.day !== currentDay) return false;

  const [startStr, endStr] = hourEntry.time.split(" - ");
  const nowDecimal = now.getHours() + now.getMinutes() / 60;

  return nowDecimal >= convertTo24(startStr) && nowDecimal < convertTo24(endStr);
}

/* Returns true if this faculty member has any office hour covering now */
function isFacultyAvailableNow(faculty) {
  return faculty.officeHours.some(isSlotActiveNow);
}

function getSlotClass(index) {
  const classes = ["", "green", "orange", "purple", "pink"];
  return classes[index % classes.length];
}

/* ---------- Build Calendar Layout ---------- */
function buildCalendarRows() {
  if (!calendarBody) return;

  const timeRows = [];
  for (let hour = 8; hour <= 23; hour++) {
    timeRows.push(hour);
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

  calendarBody.innerHTML = timeRows.map(hour => `
    <tr>
      <td class="time-cell">${hour}:00</td>
      ${days.map(day => `<td data-day="${day}" data-hour="${hour}" style="position: relative;"></td>`).join("")}
    </tr>
  `).join("");
}

/* ---------- Render Selected Faculty Calendar ---------- */
function renderFacultyCalendar(userId) {
  if (!calendarBody) return;

  buildCalendarRows();

  if (!userId) return;

  const selectedFaculty = allFacultyData.find(f => f.uid === userId);

  if (!selectedFaculty || !selectedFaculty.officeHours.length) return;

  selectedFaculty.officeHours.forEach((hourItem, index) => {
    const [startStr, endStr] = hourItem.time.split(" - ");

    const start = convertTo24(startStr);
    const end = convertTo24(endStr);

    const startHour = Math.floor(start);

    const offsetMinutes = Math.round((start - startHour) * 60);
    const durationMinutes = Math.round((end - start) * 60);

    const targetCell = document.querySelector(
      `td[data-day="${hourItem.day}"][data-hour="${startHour}"]`
    );

    if (targetCell) {
      targetCell.innerHTML += `
        <div
          class="calendar-slot ${getSlotClass(index)}"
          style="
            height: ${durationMinutes}px;
            margin-top: ${offsetMinutes}px;
          "
        >
          <div class="slot-time">${hourItem.time}</div>
          <div class="slot-room">${hourItem.room}</div>
          ${hourItem.note ? `<div class="slot-note">${hourItem.note}</div>` : ""}
        </div>
      `;
    }
  });
}

/* =========================================================================
   ASK ASSISTANT — Rule-Based Natural Language Question Engine
   Understands free-form questions about faculty office hours without
   calling any external AI service. It extracts three kinds of entities
   from the sentence (faculty name, weekday, department) using the same
   Fuse.js index already built for search, then reasons over the office
   hours already loaded in `allFacultyData` to compose a plain-language
   answer.
   ========================================================================= */

const askAssistantInput = document.getElementById("askAssistantInput");
const askAssistantBtn = document.getElementById("askAssistantBtn");
const askAssistantAnswer = document.getElementById("askAssistantAnswer");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

/* Arabic + English keywords that map onto a weekday or "today" */
const DAY_KEYWORDS = {
  sunday: "Sunday", الاحد: "Sunday", الأحد: "Sunday",
  monday: "Monday", الاثنين: "Monday",
  tuesday: "Tuesday", الثلاثاء: "Tuesday", الثلاثا: "Tuesday",
  wednesday: "Wednesday", الاربعاء: "Wednesday", الأربعاء: "Wednesday",
  thursday: "Thursday", الخميس: "Thursday"
};

const TODAY_KEYWORDS = ["today", "اليوم", "الحين", "now", "الان", "الآن"];

const DEPARTMENTS = [
  "Computer Science",
  "Computer Engineering",
  "Information Systems",
  "Cybersecurity"
];

/* Strips "Dr." / "دكتور" / "د." prefixes so name matching works cleanly */
function stripHonorifics(text) {
  return text
    .replace(/\bdr\.?\b/gi, "")
    .replace(/دكتور[ة]?/g, "")
    .replace(/\bد\.\s*/g, "")
    .trim();
}

/* Finds a weekday mentioned in the question, resolving "today" to the
   real current weekday name. Returns null if no day is mentioned. */
function extractDay(query) {
  const lower = query.toLowerCase();

  if (TODAY_KEYWORDS.some(word => lower.includes(word))) {
    return WEEKDAYS[new Date().getDay()] || null;
  }

  for (const keyword in DAY_KEYWORDS) {
    if (lower.includes(keyword)) {
      return DAY_KEYWORDS[keyword];
    }
  }

  return null;
}

/* Finds a department mentioned in the question (case-insensitive) */
function extractDepartment(query) {
  const lower = query.toLowerCase();
  return DEPARTMENTS.find(dept => lower.includes(dept.toLowerCase())) || null;
}

/* Uses the existing Fuse.js index to find the faculty member whose name
   best matches whatever is left of the question after removing
   day/department/honorific words. Returns null if nothing matches well. */
function extractFaculty(query) {
  if (!facultyFuse) return null;

  let cleaned = stripHonorifics(query);
  DEPARTMENTS.forEach(dept => {
    cleaned = cleaned.replace(new RegExp(dept, "gi"), "");
  });
  Object.keys(DAY_KEYWORDS).forEach(keyword => {
    cleaned = cleaned.replace(new RegExp(keyword, "gi"), "");
  });

  const results = facultyFuse.search(cleaned.trim());
  if (results.length && results[0].score <= 0.4) {
    return results[0].item;
  }
  return null;
}

/* Formats one faculty member's office hours (optionally filtered to a
   single day) as a short, readable answer string. */
function describeFacultyHours(faculty, day) {
  let hours = faculty.officeHours;

  if (day) {
    hours = hours.filter(item => item.day === day);
  }

  if (hours.length === 0) {
    return day
      ? `${faculty.name} has no office hours listed on ${day}.`
      : `${faculty.name} has no office hours listed yet.`;
  }

  const lines = hours.map(
    item => `${item.day} ${item.time} — ${item.room}${item.note ? ` (${item.note})` : ""}`
  );

  return `${faculty.name} (${faculty.department}):\n${lines.join("\n")}`;
}

/* Finds every faculty member with an office hour slot covering the
   current moment, optionally narrowed to one department. */
function findAvailableNow(department) {
  const now = new Date();
  const today = WEEKDAYS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (!today) return [];

  return allFacultyData.filter(faculty => {
    if (department && faculty.department !== department) return false;

    return faculty.officeHours.some(item => {
      if (item.day !== today) return false;
      const [startStr, endStr] = item.time.split(" - ");
      const startMinutes = convertTo24(startStr) * 60;
      const endMinutes = convertTo24(endStr) * 60;
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    });
  });
}

/* Main entry point: takes the raw question and returns a plain-text
   answer, reasoning over whatever entities were detected. */
function answerQuestion(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return "Type a question first — for example: \"When is Dr. Sara available?\"";
  }

  const day = extractDay(trimmed);
  const department = extractDepartment(trimmed);
  const faculty = extractFaculty(trimmed);
  const asksWhoIsFree = /who('?s| is)? (free|available)/i.test(trimmed) ||
    trimmed.includes("متاح") || trimmed.includes("متوفر");

  // "Who is available [now/today] [in <department>]?"
  if (asksWhoIsFree && !faculty) {
    const isNowQuestion = TODAY_KEYWORDS.some(word =>
      trimmed.toLowerCase().includes(word)
    );

    if (isNowQuestion) {
      const available = findAvailableNow(department);
      if (available.length === 0) {
        return department
          ? `No one in ${department} has office hours right now.`
          : "No faculty member has office hours right now.";
      }
      return (
        `Available right now${department ? ` in ${department}` : ""}: ` +
        available.map(f => f.name).join(", ")
      );
    }

    if (day) {
      const matches = allFacultyData.filter(f =>
        (!department || f.department === department) &&
        f.officeHours.some(item => item.day === day)
      );
      if (matches.length === 0) {
        return `No one has office hours listed on ${day}${department ? ` in ${department}` : ""}.`;
      }
      return `On ${day}${department ? ` in ${department}` : ""}: ` +
        matches.map(f => f.name).join(", ");
    }
  }

  // A specific faculty member was recognized in the question
  if (faculty) {
    return describeFacultyHours(faculty, day);
  }

  // Department + day mentioned, but no specific name recognized
  if (department) {
    const matches = allFacultyData.filter(f => f.department === department);
    if (matches.length === 0) {
      return `No faculty members found in ${department}.`;
    }
    return `Faculty in ${department}: ` + matches.map(f => f.name).join(", ");
  }

  return "I couldn't quite understand that. Try mentioning a faculty name, a day (e.g. Tuesday), or a department.";
}

if (askAssistantBtn && askAssistantInput && askAssistantAnswer) {
  const handleAsk = () => {
    const answer = answerQuestion(askAssistantInput.value);
    askAssistantAnswer.style.display = "block";
    askAssistantAnswer.textContent = answer;
  };

  askAssistantBtn.addEventListener("click", handleAsk);
  askAssistantInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAsk();
    }
  });
}

/* ---------- Access Protection ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const userDoc = await db.collection("users").doc(user.uid).get();

    if (!userDoc.exists) {
      window.location.href = "login.html";
      return;
    }

    const userData = userDoc.data();

    if (userData.role === "admin") {
      window.location.href = "admin.html";
      return;
    }

    if (userData.role !== "student") {
      window.location.href = "faculty.html";
      return;
    }

    currentUser = user;
    currentUserData = userData;

    localStorage.setItem("currentUser", user.email);
    localStorage.setItem("currentRole", userData.role);

    buildCalendarRows();
    await loadAllFacultyData();
    buildFacultySearchIndex();
    filterRealFaculty();

    // Keep the "Available now" badges accurate without a full page reload
    setInterval(filterRealFaculty, 60 * 1000);
    populateFacultySelect();

    if (searchInput) {
      searchInput.addEventListener("input", filterRealFaculty);
    }

    if (departmentFilter) {
      departmentFilter.addEventListener("change", filterRealFaculty);
    }

    if (calendarSearchInput) {
      calendarSearchInput.addEventListener("input", filterCalendarFacultySelect);
    }

    if (calendarFacultySelect) {
      calendarFacultySelect.addEventListener("change", function () {
        renderFacultyCalendar(this.value);
      });
    }
  } catch (error) {
    console.error("Protection error:", error);
    window.location.href = "login.html";
  }
});