/* ---------- Page Elements ---------- */
const facultyProfileForm = document.getElementById("facultyProfileForm");
const facultyProfileInfo = document.getElementById("facultyProfileInfo");
const profileMessage = document.getElementById("profileMessage");

const profileNameInput = document.getElementById("profileName");
const profileDepartmentInput = document.getElementById("profileDepartment");
const profileContactEmailInput = document.getElementById("profileContactEmail");

const facultyName = document.getElementById("facultyName");
const facultyEmail = document.getElementById("facultyEmail");
const facultyDepartment = document.getElementById("facultyDepartment");
const facultyContactEmail = document.getElementById("facultyContactEmail");
const editProfileBtn = document.getElementById("editProfileBtn");

const officeHoursForm = document.getElementById("officeHoursForm");
const officeHoursList = document.getElementById("officeHoursList");
const officeHoursCount = document.getElementById("officeHoursCount");
const facultyFormMessage = document.getElementById("facultyFormMessage");

const notificationForm = document.getElementById("notificationForm");
const notificationText = document.getElementById("notificationText");
const notificationMessage = document.getElementById("notificationMessage");

/* ---------- Global State ---------- */
let currentUser = null;
let currentUserData = null;
let officeHoursData = [];

/* ---------- Utility Functions ---------- */
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

function getCurrentFacultyName() {
  if (currentUserData && currentUserData.name) {
    return currentUserData.name;
  }

  return currentUser?.email || "Faculty Member";
}

function formatTime(time) {
  const parts = time.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }

  return hours + ":" + minutes + " " + ampm;
}

/* ---------- Conflict Detection Helpers ---------- */

/* Converts a 24-hour "HH:MM" input value into minutes since midnight */
function timeInputToMinutes(time24) {
  const [hours, minutes] = time24.split(":").map(Number);
  return hours * 60 + minutes;
}

/* Converts a displayed label like "1:30 PM" into minutes since midnight */
function timeLabelToMinutes(label) {
  const [time, period] = label.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/* Converts minutes since midnight back into a "1:30 PM" style label */
function minutesToTimeLabel(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const paddedMinutes = String(minutes).padStart(2, "0");
  return hours + ":" + paddedMinutes + " " + ampm;
}

/* Splits a stored "8:00 AM - 9:00 AM" range into { start, end } minutes */
function parseStoredTimeRange(rangeStr) {
  const [startLabel, endLabel] = rangeStr.split(" - ");
  return {
    start: timeLabelToMinutes(startLabel),
    end: timeLabelToMinutes(endLabel)
  };
}

/* True if [startA, endA) overlaps [startB, endB) */
function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

/* Scans a room's existing bookings on a given day and returns the first
   free slot (as a "H:MM AM/PM - H:MM AM/PM" label) that is at least
   `durationMinutes` long, within working hours (8:00 AM - 6:00 PM). */
function findNextAvailableSlot(bookedRanges, durationMinutes) {
  const DAY_START = 8 * 60;   // 8:00 AM
  const DAY_END = 18 * 60;    // 6:00 PM

  const sorted = [...bookedRanges].sort((a, b) => a.start - b.start);

  let cursor = DAY_START;

  for (const range of sorted) {
    if (range.start - cursor >= durationMinutes) {
      return { start: cursor, end: cursor + durationMinutes };
    }
    cursor = Math.max(cursor, range.end);
  }

  if (DAY_END - cursor >= durationMinutes) {
    return { start: cursor, end: cursor + durationMinutes };
  }

  return null;
}

/* ---------- Notifications ---------- */
async function addNotification(message, type = "manual") {
  try {
    await db.collection("notifications").add({
      message: message,
      type: type,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error saving notification:", error);
  }
}

/* ---------- Profile UI ---------- */
function fillProfileUI(data, email) {
  setText(facultyName, data.name || "Not provided");
  setText(facultyEmail, email || "Not provided");
  setText(facultyDepartment, data.department || "Not provided");
  setText(facultyContactEmail, data.contactEmail || "Not provided");
}

function showProfileInfo() {
  if (facultyProfileForm) facultyProfileForm.style.display = "none";
  if (facultyProfileInfo) facultyProfileInfo.style.display = "grid";
  if (editProfileBtn) editProfileBtn.style.display = "inline-block";

  setText(profileMessage, "");
  generateOfficeDoorQrCode();
}

function showProfileForm() {
  if (facultyProfileForm) facultyProfileForm.style.display = "block";
  if (facultyProfileInfo) facultyProfileInfo.style.display = "none";
  if (editProfileBtn) editProfileBtn.style.display = "none";

  const qrSection = document.getElementById("qrSection");
  if (qrSection) qrSection.style.display = "none";
}

/* ---------- Office Door QR Code ---------- */
function generateOfficeDoorQrCode() {
  if (!currentUser || typeof QRCode === "undefined") return;

  const qrSection = document.getElementById("qrSection");
  const qrCodeCanvas = document.getElementById("qrCodeCanvas");
  if (!qrSection || !qrCodeCanvas) return;

  qrSection.style.display = "block";
  qrCodeCanvas.innerHTML = "";

  const statusPageUrl =
    window.location.origin + "/faculty-status.html?id=" + currentUser.uid;

  new QRCode(qrCodeCanvas, {
    text: statusPageUrl,
    width: 180,
    height: 180,
    colorDark: "#16231c",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

const downloadQrBtn = document.getElementById("downloadQrBtn");
if (downloadQrBtn) {
  downloadQrBtn.addEventListener("click", function () {
    const qrCodeCanvas = document.getElementById("qrCodeCanvas");
    const canvas = qrCodeCanvas ? qrCodeCanvas.querySelector("canvas") : null;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "office-door-qr-code.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

async function loadFacultyProfile() {
  if (!currentUser) return;

  try {
    const userDoc = await db.collection("users").doc(currentUser.uid).get();

    if (!userDoc.exists) {
      showProfileForm();
      return;
    }

    currentUserData = userDoc.data();
    fillProfileUI(currentUserData, currentUser.email);

    if (currentUserData.name && currentUserData.department) {
      showProfileInfo();
    } else {
      showProfileForm();
    }
  } catch (error) {
    console.error("Error loading faculty profile:", error);
  }
}

function openProfileEditor() {
  if (!currentUserData) return;

  if (profileNameInput) {
    profileNameInput.value = currentUserData.name || "";
  }

  if (profileDepartmentInput) {
    profileDepartmentInput.value = currentUserData.department || "";
  }

  if (profileContactEmailInput) {
    profileContactEmailInput.value = currentUserData.contactEmail || "";
  }

  showProfileForm();
  setText(profileMessage, "You can now edit your profile.");
}

/* ---------- Profile Events ---------- */
if (editProfileBtn) {
  editProfileBtn.addEventListener("click", openProfileEditor);
}

if (facultyProfileForm) {
  facultyProfileForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentUser) return;

    const name = profileNameInput.value.trim();
    const department = profileDepartmentInput.value;
    const contactEmail = profileContactEmailInput.value.trim();

    if (!name || !department) {
      setText(profileMessage, "Please enter your name and department.");
      return;
    }

    try {
      // Save or update faculty profile in Firestore
      await db.collection("users").doc(currentUser.uid).set(
        {
          name: name,
          email: currentUser.email,
          role: "faculty",
          department: department,
          contactEmail: contactEmail,
          updatedAt: new Date()
        },
        { merge: true }
      );

      currentUserData = {
        ...(currentUserData || {}),
        name,
        email: currentUser.email,
        role: "faculty",
        department,
        contactEmail
      };

      fillProfileUI(currentUserData, currentUser.email);
      showProfileInfo();
      setText(profileMessage, "Profile saved successfully.");
    } catch (error) {
      console.error("Error saving profile:", error);
      setText(profileMessage, "Failed to save profile.");
    }
  });
}

/* ---------- Office Hours ---------- */
async function renderOfficeHours() {
  if (!officeHoursList || !currentUser) return;

  try {
    const snapshot = await db
      .collection("officeHours")
      .where("userId", "==", currentUser.uid)
      .get();

    officeHoursData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (officeHoursData.length === 0) {
      officeHoursList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No office hours added yet</h3>
          <p>Add your first office hour entry using the form above.</p>
        </div>
      `;

      setText(officeHoursCount, "0 office hour entries");
      return;
    }

    officeHoursList.innerHTML = officeHoursData.map(item => `
      <div class="office-hour-card">
        <div class="office-hour-card-top">
          <div>
            <h3 class="office-hour-day">${item.day}</h3>
          </div>
          <button class="delete-btn" onclick="deleteOfficeHour('${item.id}')">Delete</button>
        </div>

        <div class="office-hour-details">
          <p><strong>Time:</strong> ${item.time}</p>
          <p><strong>Location:</strong> ${item.room}</p>
          ${item.note ? `<p><strong>Note:</strong> ${item.note}</p>` : ""}
        </div>
      </div>
    `).join("");

    setText(
      officeHoursCount,
      officeHoursData.length +
        " office hour entr" +
        (officeHoursData.length === 1 ? "y" : "ies")
    );
  } catch (error) {
    console.error("Error loading office hours:", error);

    officeHoursList.innerHTML = `
      <div class="empty-office-hours">
        <h3>Failed to load office hours</h3>
        <p>Please check Firebase query or Firestore rules.</p>
      </div>
    `;
  }
}

async function deleteOfficeHour(docId) {

  try {
    const docRef = await db.collection("officeHours").doc(docId).get();
    if (!docRef.exists) return;

    const deletedItem = docRef.data();

    const confirmed = confirm(
      "Are you sure you want to delete this office hour?"
    );

    if (!confirmed) {
      return;
    }

    const facultyNameValue = getCurrentFacultyName();

    await db.collection("officeHours").doc(docId).delete();

    await addNotification(
      `${facultyNameValue} deleted office hours on ${deletedItem.day} (${deletedItem.time}).`,
      "automatic"
    );

    await renderOfficeHours();
  } catch (error) {
    console.error("Error deleting office hour:", error);
  }
}

async function resetOfficeHours() {
  if (!currentUser) return;

  const confirmed = confirm("Are you sure you want to reset all office hours data?");
  if (!confirmed) return;

  try {
    const snapshot = await db
      .collection("officeHours")
      .where("userId", "==", currentUser.uid)
      .get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    await renderOfficeHours();
  } catch (error) {
    console.error("Error resetting office hours:", error);
  }
}

if (officeHoursForm) {
  officeHoursForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentUser) return;

    const officeNote = document.getElementById("officeNote").value.trim();
    const officeDay = document.getElementById("officeDay").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const officeRoom = document.getElementById("officeRoom").value.trim();

    if (!officeDay || !startTime || !endTime || !officeRoom) {
      setText(facultyFormMessage, "Please fill in all fields.");
      return;
    }

    if (endTime <= startTime) {
      setText(facultyFormMessage, "End time must be later than start time.");
      return;
    }
    const formattedTime =
  formatTime(startTime) + " - " + formatTime(endTime);

const duplicateQuery = await db
  .collection("officeHours")
  .where("userId", "==", currentUser.uid)
  .where("day", "==", officeDay)
  .where("time", "==", formattedTime)
  .where("room", "==", officeRoom)
  .get();

if (!duplicateQuery.empty) {
  setText(
    facultyFormMessage,
    "An office hour with the same day, time, and room already exists."
  );
  return;
}

/* ---------- Conflict Detection ---------- */
const newStartMinutes = timeInputToMinutes(startTime);
const newEndMinutes = timeInputToMinutes(endTime);

const sameDayQuery = await db
  .collection("officeHours")
  .where("day", "==", officeDay)
  .get();

const sameDayEntries = sameDayQuery.docs.map(doc => doc.data());

// 1) Room conflict: another entry (any faculty) already booked this
//    room, on this day, during an overlapping time window.
const roomConflict = sameDayEntries.find(item => {
  if (item.room !== officeRoom) return false;
  const range = parseStoredTimeRange(item.time);
  return rangesOverlap(newStartMinutes, newEndMinutes, range.start, range.end);
});

// 2) Self conflict: this faculty member already has office hours at an
//    overlapping time somewhere else (can't be in two places at once).
const selfConflict = sameDayEntries.find(item => {
  if (item.userId !== currentUser.uid) return false;
  const range = parseStoredTimeRange(item.time);
  return rangesOverlap(newStartMinutes, newEndMinutes, range.start, range.end);
});

if (roomConflict || selfConflict) {
  const conflictingRoomEntries = sameDayEntries.filter(
    item => item.room === officeRoom
  );
  const bookedRanges = conflictingRoomEntries.map(item =>
    parseStoredTimeRange(item.time)
  );
  const durationMinutes = newEndMinutes - newStartMinutes;
  const suggestion = findNextAvailableSlot(bookedRanges, durationMinutes);

  let message;
  if (roomConflict) {
    message = `Room ${officeRoom} is already booked on ${officeDay} at ${roomConflict.time}.`;
  } else {
    message = `You already have office hours on ${officeDay} at ${selfConflict.time} — you can't be in two places at once.`;
  }

  if (suggestion) {
    message += ` Try ${minutesToTimeLabel(suggestion.start)} - ${minutesToTimeLabel(suggestion.end)} instead.`;
  } else {
    message += " No free slot of that length is available in this room today.";
  }

  setText(facultyFormMessage, message);
  return;
}

    const newOfficeHour = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      day: officeDay,
      time: formattedTime,
      room: officeRoom,
      note: officeNote,
      createdAt: new Date()
    };

    try {
      // Save office hours entry for the logged-in faculty member
      await db.collection("officeHours").add(newOfficeHour);

      const facultyNameValue = getCurrentFacultyName();
      await addNotification(
        `${facultyNameValue} added office hours on ${newOfficeHour.day} (${newOfficeHour.time}).`,
        "automatic"
      );

      setText(facultyFormMessage, "Office hour added successfully.");
      officeHoursForm.reset();

      await renderOfficeHours();
    } catch (error) {
      console.error("Error saving office hour:", error);
      setText(facultyFormMessage, "Failed to save office hour.");
    }
  });
}

/* ---------- Manual Notification ---------- */
if (notificationForm) {
  notificationForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const text = notificationText.value.trim();

    if (!text) {
      setText(notificationMessage, "Please write a notification message.");
      return;
    }

    const facultyNameValue = getCurrentFacultyName();
    await addNotification(`${facultyNameValue}: ${text}`, "manual");

    setText(notificationMessage, "Notification sent successfully.");
    notificationForm.reset();
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

    if (userData.role !== "faculty") {
      window.location.href = "student.html";
      return;
    }

    currentUser = user;
    currentUserData = userData;

    localStorage.setItem("currentUser", user.email);
    localStorage.setItem("currentRole", userData.role);

    await loadFacultyProfile();
    await renderOfficeHours();
  } catch (error) {
    console.error("Protection error:", error);
    window.location.href = "login.html";
  }
});