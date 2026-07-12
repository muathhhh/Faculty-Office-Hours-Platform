/* ---------- Elements ---------- */
const usersList = document.getElementById("usersList");
const notificationsList = document.getElementById("notificationsList");
const officeHoursAdminList = document.getElementById("officeHoursAdminList");
const logsList = document.getElementById("logsList");
const notificationInput = document.getElementById("notificationInput");

const totalUsersCount = document.getElementById("totalUsersCount");
const totalStudentsCount = document.getElementById("totalStudentsCount");
const totalFacultyCount = document.getElementById("totalFacultyCount");
const totalAdminsCount = document.getElementById("totalAdminsCount");
const totalNotificationsCount = document.getElementById("totalNotificationsCount");
const totalOfficeHoursCount = document.getElementById("totalOfficeHoursCount");

/* ---------- Globals ---------- */
let currentAdminUser = null;
let currentAdminData = null;

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

function showAdminSection(sectionId) {
  const sections = document.querySelectorAll(".admin-section");

  sections.forEach(section => {
    section.style.display = "none";
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = "block";
  }
}

/* ---------- Logs ---------- */
async function addLog(action, target) {
  try {
    await db.collection("logs").add({
      adminEmail: currentAdminUser ? currentAdminUser.email : "Unknown admin",
      action: action,
      target: target,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error adding log:", error);
  }
}

async function loadLogs() {
  if (!logsList) return;

  try {
    const snapshot = await db
      .collection("logs")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    logsList.innerHTML = "";

    if (snapshot.empty) {
      logsList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No logs found</h3>
          <p>Admin activity logs will appear here.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const item = doc.data();

      let formattedDate = "No date";
      if (item.createdAt && item.createdAt.seconds) {
        formattedDate = new Date(item.createdAt.seconds * 1000).toLocaleString();
      }

      logsList.innerHTML += `
        <div class="admin-card">
          <div class="admin-card-top">
            <div>
              <h3>${item.action || "No action"}</h3>
              <p>${formattedDate}</p>
            </div>
            <span class="admin-role-badge">LOG</span>
          </div>

          <div class="admin-card-body">
            <p><strong>Admin:</strong> ${item.adminEmail || "Unknown"}</p>
            <p><strong>Target:</strong> ${item.target || "No target"}</p>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading logs:", error);
  }
}

/* ---------- Stats ---------- */
async function loadAdminStats() {
  try {
    const usersSnapshot = await db.collection("users").get();
    const notificationsSnapshot = await db.collection("notifications").get();
    const officeHoursSnapshot = await db.collection("officeHours").get();

    let students = 0;
    let faculty = 0;
    let admins = 0;

    usersSnapshot.forEach(doc => {
      const user = doc.data();

      if (user.role === "student") students++;
      if (user.role === "faculty") faculty++;
      if (user.role === "admin") admins++;
    });

    setText(totalUsersCount, usersSnapshot.size);
    setText(totalStudentsCount, students);
    setText(totalFacultyCount, faculty);
    setText(totalAdminsCount, admins);
    setText(totalNotificationsCount, notificationsSnapshot.size);
    setText(totalOfficeHoursCount, officeHoursSnapshot.size);
  } catch (error) {
    console.error("Error loading admin stats:", error);
  }
}

/* ---------- Users Management ---------- */
async function loadUsers() {
  if (!usersList) return;

  try {
    const snapshot = await db.collection("users").get();

    usersList.innerHTML = "";

    if (snapshot.empty) {
      usersList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No users found</h3>
          <p>User accounts will appear here.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const user = doc.data();
      const isCurrentAdmin = currentAdminUser && doc.id === currentAdminUser.uid;

      usersList.innerHTML += `
        <div class="admin-card">
          <div class="admin-card-top">
            <div>
              <h3>${user.name || "No name"}</h3>
              <p>${user.email || "No email"}</p>
            </div>
            <span class="admin-role-badge">${user.role || "no role"}</span>
          </div>

          <div class="admin-card-body">
            <label for="role-${doc.id}"><strong>Role</strong></label>
            <select id="role-${doc.id}" class="admin-input">
              <option value="student" ${user.role === "student" ? "selected" : ""}>Student</option>
              <option value="faculty" ${user.role === "faculty" ? "selected" : ""}>Faculty</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
            </select>

            <div class="admin-actions-row">
              <button class="small-btn" onclick="updateUserRole('${doc.id}')">Update Role</button>
              <button
                class="delete-btn"
                onclick="deleteUser('${doc.id}', '${user.email || ""}')"
                ${isCurrentAdmin ? "disabled" : ""}
              >
                ${isCurrentAdmin ? "Current Admin" : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

async function updateUserRole(userId) {
  const roleSelect = document.getElementById(`role-${userId}`);
  if (!roleSelect) return;

  const newRole = roleSelect.value;

  const confirmed = confirm(`Are you sure you want to change this user's role to ${newRole}?`);
  if (!confirmed) return;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      alert("User not found.");
      return;
    }

    const userData = userDoc.data();
    const oldRole = userData.role || "no role";
    const userEmail = userData.email || userId;

    if (oldRole === newRole) {
      alert("This user already has this role.");
      return;
    }

    await userRef.update({
      role: newRole
    });

    await addLog(
      "Updated user role",
      `${userEmail}: ${oldRole} → ${newRole}`
    );

    alert("Role updated successfully.");

    await loadUsers();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error updating user role:", error);
    alert("Failed to update role. Check Firestore rules.");
  }
}

async function deleteUser(userId, email) {
  if (currentAdminUser && userId === currentAdminUser.uid) {
    alert("You cannot delete your own admin account.");
    return;
  }

  const confirmed = confirm(`Are you sure you want to delete this user?\n${email}`);
  if (!confirmed) return;

  try {
    await db.collection("users").doc(userId).delete();

    await addLog("Deleted user", email || userId);
    await loadUsers();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error deleting user:", error);
  }
}

/* ---------- Notifications Management ---------- */
async function addNotification() {
  const text = notificationInput.value.trim();

  if (!text) {
    alert("Please write a notification message.");
    return;
  }

  try {
    await db.collection("notifications").add({
      message: text,
      type: "manual",
      createdAt: new Date()
    });

    await addLog("Added notification", text);
    notificationInput.value = "";
    await loadNotifications();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error adding notification:", error);
  }
}

async function loadNotifications() {
  if (!notificationsList) return;

  try {
    const snapshot = await db
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .get();

    notificationsList.innerHTML = "";

    if (snapshot.empty) {
      notificationsList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No notifications found</h3>
          <p>Notifications will appear here.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const item = doc.data();

      let formattedDate = "No date";
      if (item.createdAt && item.createdAt.seconds) {
        formattedDate = new Date(item.createdAt.seconds * 1000).toLocaleString();
      }

      const safeMessage = (item.message || "").replace(/"/g, "&quot;");

      notificationsList.innerHTML += `
        <div class="admin-card">
          <div class="admin-card-top">
            <div>
              <h3>${item.type || "Notification"}</h3>
              <p>${formattedDate}</p>
            </div>
          </div>

          <div class="admin-card-body">
            <input
              id="notification-edit-${doc.id}"
              class="admin-input"
              type="text"
              value="${safeMessage}"
            />

            <div class="admin-actions-row">
              <button class="small-btn" onclick="updateNotification('${doc.id}')">Update</button>
              <button class="delete-btn" onclick="deleteNotification('${doc.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
  }
}

async function updateNotification(notificationId) {
  const input = document.getElementById(`notification-edit-${notificationId}`);
  if (!input) return;

  const newMessage = input.value.trim();
  if (!newMessage) return;

  const confirmed = confirm("Are you sure you want to update this notification?");
  if (!confirmed) return;

  try {
    const notificationRef = db.collection("notifications").doc(notificationId);
    const oldDoc = await notificationRef.get();

    let oldMessage = "Unknown notification";
    if (oldDoc.exists) {
      oldMessage = oldDoc.data().message || "No message";
    }

    await notificationRef.update({
      message: newMessage
    });

    await addLog(
      "Updated notification",
      `Old: ${oldMessage} | New: ${newMessage}`
    );

    await loadNotifications();
    await loadLogs();
  } catch (error) {
    console.error("Error updating notification:", error);
  }
}

async function deleteNotification(notificationId) {
  const confirmed = confirm("Are you sure you want to delete this notification?");
  if (!confirmed) return;

  try {
    const notificationRef = db.collection("notifications").doc(notificationId);
    const notificationDoc = await notificationRef.get();

    let deletedMessage = notificationId;
    if (notificationDoc.exists) {
      deletedMessage = notificationDoc.data().message || notificationId;
    }

    await notificationRef.delete();

    await addLog("Deleted notification", deletedMessage);
    await loadNotifications();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

/* ---------- Office Hours Management ---------- */
async function loadOfficeHours() {
  if (!officeHoursAdminList) return;

  try {
    const snapshot = await db.collection("officeHours").get();

    officeHoursAdminList.innerHTML = "";

    if (snapshot.empty) {
      officeHoursAdminList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No office hours found</h3>
          <p>Office hours will appear here.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const item = doc.data();

      officeHoursAdminList.innerHTML += `
        <div class="admin-card">
          <div class="admin-card-top">
            <div>
              <h3>${item.day || "No day"}</h3>
              <p>${item.userEmail || "Unknown user"}</p>
            </div>
          </div>

          <div class="admin-card-body">
            <p><strong>Time:</strong> ${item.time || "No time"}</p>
            <p><strong>Location:</strong> ${item.room || "No location"}</p>
            ${item.note ? `<p><strong>Note:</strong> ${item.note}</p>` : ""}

            <div class="admin-actions-row">
              <button class="delete-btn" onclick="deleteOfficeHour('${doc.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading office hours:", error);
  }
}

async function deleteOfficeHour(docId) {
  const confirmed = confirm("Are you sure you want to delete this office hour?");
  if (!confirmed) return;

  try {
    const officeHourRef = db.collection("officeHours").doc(docId);
    const officeHourDoc = await officeHourRef.get();

    let targetText = docId;
    if (officeHourDoc.exists) {
      const item = officeHourDoc.data();
      targetText = `${item.userEmail || "Unknown"} - ${item.day || "No day"} - ${item.time || "No time"}`;
    }

    await officeHourRef.delete();

    await addLog("Deleted office hour", targetText);
    await loadOfficeHours();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error deleting office hour:", error);
  }
}

async function deleteAllOfficeHours() {
  const confirmed = confirm("Are you sure you want to delete ALL office hours?");
  if (!confirmed) return;

  try {
    const snapshot = await db.collection("officeHours").get();
    const batch = db.batch();
    const count = snapshot.size;

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    await addLog("Deleted all office hours", `${count} office hour records removed`);
    await loadOfficeHours();
    await loadAdminStats();
    await loadLogs();
  } catch (error) {
    console.error("Error deleting all office hours:", error);
  }
}

/* ---------- Admin Protection ---------- */
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

    if (userData.role !== "admin") {
      alert("Access denied.");
      window.location.href = "login.html";
      return;
    }

    currentAdminUser = user;
    currentAdminData = userData;

    localStorage.setItem("currentUser", user.email || "");
    localStorage.setItem("currentRole", userData.role || "");

    await loadAdminStats();
    await loadUsers();
    await loadNotifications();
    await loadOfficeHours();
    await loadLogs();
  } catch (error) {
    console.error("Admin protection error:", error);
    window.location.href = "login.html";
  }
});