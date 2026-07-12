/* ---------- Page Elements ---------- */
const statusCard = document.getElementById("statusCard");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

/* ---------- Helpers (mirrors the logic used on the student dashboard) ---------- */
function convertTo24(timeStr) {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours + minutes / 60;
}

function isSlotActiveNow(hourEntry) {
  const now = new Date();
  const currentDay = WEEKDAYS[now.getDay()];

  if (hourEntry.day !== currentDay) return false;

  const [startStr, endStr] = hourEntry.time.split(" - ");
  const nowDecimal = now.getHours() + now.getMinutes() / 60;

  return nowDecimal >= convertTo24(startStr) && nowDecimal < convertTo24(endStr);
}

function renderError(message) {
  statusCard.innerHTML = `
    <h2>${message}</h2>
    <a class="status-back-link" href="index.html">← Back to Home</a>
  `;
}

async function renderFacultyStatus(uid) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists || userDoc.data().role !== "faculty") {
      renderError("Faculty member not found.");
      return;
    }

    const faculty = userDoc.data();

    const officeHoursSnapshot = await db
      .collection("officeHours")
      .where("userId", "==", uid)
      .get();

    const officeHours = officeHoursSnapshot.docs.map(doc => doc.data());
    const availableNow = officeHours.some(isSlotActiveNow);

    const scheduleHtml =
      officeHours.length > 0
        ? officeHours
            .map(
              hour => `
              <div class="student-office-hour-item${isSlotActiveNow(hour) ? " active-now" : ""}">
                <p><strong>Day:</strong> ${hour.day}${isSlotActiveNow(hour) ? ' <span class="active-now-tag">Happening now</span>' : ""}</p>
                <p><strong>Time:</strong> ${hour.time}</p>
                <p><strong>Location:</strong> ${hour.room}</p>
                ${hour.note ? `<p><strong>Note:</strong> ${hour.note}</p>` : ""}
              </div>
            `
            )
            .join("")
        : `<p class="no-office-hours-text">No office hours listed yet.</p>`;

    statusCard.innerHTML = `
      <h2>${faculty.name}</h2>
      <p class="status-department">${faculty.department || ""}</p>

      <span class="live-status-badge ${availableNow ? "is-open" : "is-closed"}">
        <span class="live-status-dot"></span>
        ${availableNow ? "Available now" : "Not available right now"}
      </span>

      <div class="status-schedule">
        <h3>Weekly Office Hours</h3>
        ${scheduleHtml}
      </div>

      <a class="status-back-link" href="student.html">← Search all faculty</a>
    `;
  } catch (error) {
    console.error("Error loading faculty status:", error);
    renderError("Something went wrong loading this page.");
  }
}

/* ---------- Access Protection ---------- */
/* This page is reached by scanning a QR code on an office door, so it
   needs to work for any signed-in user (student, faculty, or admin) —
   it just requires being logged in, same as the rest of the platform. */
auth.onAuthStateChanged(function (user) {
  const params = new URLSearchParams(window.location.search);
  const facultyId = params.get("id");

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!facultyId) {
    renderError("No faculty specified.");
    return;
  }

  renderFacultyStatus(facultyId);
});
