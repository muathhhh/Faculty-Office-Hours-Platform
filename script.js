console.log("Main script loaded successfully");

/* Firebase `auth` and `db` are already initialized in firebase-config.js,
   which is loaded before this file on every page. */

/* ---------- Global Logout ---------- */
/* This function can be used on pages that need a shared logout action */
function logout() {
  if (auth) {
    auth.signOut()
      .then(() => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("currentRole");
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Logout error:", error);
        localStorage.removeItem("currentUser");
        localStorage.removeItem("currentRole");
        window.location.href = "login.html";
      });
  } else {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentRole");
    window.location.href = "login.html";
  }
}

/* ---------- Show Logged-in User Info ---------- */
/* This shows the current user's email in pages that contain #userEmail */
function showUserInfo() {
  const email = localStorage.getItem("currentUser");
  const userEmailElement = document.getElementById("userEmail");

  if (userEmailElement && email) {
    userEmailElement.textContent = email;
  }
}

/* ---------- Redirect Logged-in User ---------- */
/* If the user is already signed in and opens the login page, redirect them automatically */
function redirectLoggedInUser() {
  if (!auth || !db) return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();

      localStorage.setItem("currentUser", user.email || "");
      localStorage.setItem("currentRole", userData.role || "");

      /* Update user email in the page after login state is confirmed */
      showUserInfo();

      const currentPage = window.location.pathname.split("/").pop();

      /* Redirect only from the login page */
      if (currentPage !== "login.html") return;

      if (userData.role === "admin") {
        window.location.href = "admin.html";
      } else if (userData.role === "faculty") {
        window.location.href = "faculty.html";
      } else {
        window.location.href = "student.html";
      }

    } catch (error) {
      console.error("Redirect error:", error);
    }
  });
}

/* ---------- Init ---------- */
showUserInfo();
redirectLoggedInUser();