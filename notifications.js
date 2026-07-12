/* ---------- Page Elements ---------- */
const notificationsNav = document.getElementById("notificationsNav");
const notificationsLogout = document.getElementById("notificationsLogout");
const notificationsList = document.getElementById("notificationsList");

/* ---------- Global State ---------- */
let currentUser = null;
let currentUserData = null;

/* ---------- Helpers ---------- */
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

/* ---------- Dynamic Navigation ---------- */
/* The navigation links change based on whether the user is a student or faculty member */
function renderNotificationsNav(role) {
  if (!notificationsNav) return;

  if (role === "faculty") {
    notificationsNav.innerHTML = `
      <a href="faculty.html" class="small-btn">Dashboard</a>
      <a href="notifications.html" class="small-btn">Notifications</a>
    `;
  } else if (role === "student") {
    notificationsNav.innerHTML = `
      <a href="student.html" class="small-btn">Dashboard</a>
      <a href="notifications.html" class="small-btn">Notifications</a>
    `;
  } else {
    notificationsNav.innerHTML = `
      <a href="index.html" class="small-btn">Back to Home</a>
      <a href="notifications.html" class="small-btn">Notifications</a>
    `;
  }

  if (notificationsLogout) {
    notificationsLogout.style.display = role ? "inline-block" : "none";
  }
}

/* ---------- Render Notifications ---------- */
/* The page loads the latest notifications and shows the newest items first */
async function renderNotifications() {
  if (!notificationsList) return;

  try {
    notificationsList.innerHTML = `
      <div class="empty-office-hours">
        <p>Loading notifications...</p>
      </div>
    `;

    const snapshot = await db
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      notificationsList.innerHTML = `
        <div class="empty-office-hours">
          <h3>No notifications yet</h3>
          <p>Notifications will appear here when faculty members add updates.</p>
        </div>
      `;
      return;
    }

    notificationsList.innerHTML = snapshot.docs.map(doc => {
      const item = doc.data();

      let formattedDate = "No date";
      if (item.createdAt && item.createdAt.seconds) {
        formattedDate = new Date(item.createdAt.seconds * 1000).toLocaleString();
      }

      return `
        <div class="notification-card">
          <div class="notification-top">
            <span class="notification-badge ${item.type}">${item.type}</span>
            <span class="notification-date">${formattedDate}</span>
          </div>
          <p class="notification-text">${item.message}</p>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Error loading notifications:", error);

    notificationsList.innerHTML = `
      <div class="empty-office-hours">
        <h3>Failed to load notifications</h3>
        <p>Please check Firebase connection or Firestore rules.</p>
      </div>
    `;
  }
}

/* ---------- Access Protection ---------- */
/* Only authenticated users can access this page */
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

    currentUser = user;
    currentUserData = userData;

    localStorage.setItem("currentUser", user.email);
    localStorage.setItem("currentRole", userData.role);

    renderNotificationsNav(userData.role);
    await renderNotifications();
  } catch (error) {
    console.error("Protection error:", error);
    window.location.href = "login.html";
  }
});