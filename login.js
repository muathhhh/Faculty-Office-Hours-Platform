/* ---------- Form Elements ---------- */
const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const nameInput = document.getElementById("name");
const roleInput = document.getElementById("role");

const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const toggleMode = document.getElementById("toggleMode");
const extraFields = document.getElementById("extraFields");
const loginMessage = document.getElementById("loginMessage");

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);

  if (isLoading) {
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = isRegisterMode
      ? "Creating Account..."
      : "Logging in...";
  } else {
    submitBtn.textContent =
      submitBtn.dataset.originalText ||
      (isRegisterMode ? "Create Account" : "Login");
  }
}

/* ---------- Page State ---------- */
let isRegisterMode = false;

/* ---------- Allowed Email Domains ---------- */
function isAllowedEmail(email) {
  const normalizedEmail = email.toLowerCase();
  return (
    normalizedEmail.endsWith("@gmail.com") ||
    normalizedEmail.endsWith("@kku.edu.sa")
  );
}

/* ---------- Strong Password Validation ---------- */
/* Password must contain letters, numbers, and symbols */
function isStrongPassword(password) {
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/.test(password);

  return (
    password.length >= 8 &&
    password.length <= 20 &&
    hasLetter &&
    hasNumber &&
    hasSymbol
  );
}

/* ---------- Show Message ---------- */
function showMessage(message, type = "error") {
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.className = `login-message ${type}`;
}

/* ---------- Redirect User Based on Role ---------- */
/* Admin accounts are assigned manually from Firestore */
function redirectUser(role) {
  if (role === "admin") {
    window.location.href = "admin.html";
  } else if (role === "faculty") {
    window.location.href = "faculty.html";
  } else {
    window.location.href = "student.html";
  }
}

/* ---------- Toggle Between Login and Register ---------- */
if (toggleMode) {
  toggleMode.addEventListener("click", function (e) {
    e.preventDefault();

    isRegisterMode = !isRegisterMode;

    if (isRegisterMode) {
      formTitle.textContent = "Create a new account";
      submitBtn.textContent = "Create Account";
      extraFields.style.display = "block";
      toggleMode.textContent = "Login";
      showMessage("");
    } else {
      formTitle.textContent = "Login to your account";
      submitBtn.textContent = "Login";
      extraFields.style.display = "none";
      toggleMode.textContent = "Create Account (Register)";
      showMessage("");
    }
  });
}

/* ---------- Handle Login / Register ---------- */
if (authForm) {
  authForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    setLoading(true);

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    if (!email || !password) {
    showMessage("Please enter your email and password.");
    setLoading(false);
    return;
}

    try {
      if (isRegisterMode) {
        const name = nameInput.value.trim();
        const role = roleInput.value;

        if (!name) {
    showMessage("Please enter your full name.");
    setLoading(false);
    return;
}

        /* Restrict account creation to Gmail and KKU emails only */
        if (!isAllowedEmail(email)) {
    showMessage("Only Gmail or KKU emails are allowed for registration.");
    setLoading(false);
    return;
}

        /* Enforce strong password rules during account creation */
        if (!isStrongPassword(password)) {
    showMessage("Password must be 8-20 characters and include letters, numbers, and symbols.");
    setLoading(false);
    return;
}

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        /* Save user data in Firestore */
        await db.collection("users").doc(user.uid).set({
          name: name,
          email: email,
          role: role,
          createdAt: new Date()
        });

        localStorage.setItem("currentUser", email);
        localStorage.setItem("currentRole", role);

        showMessage("Account created successfully.");
        redirectUser(role);
      } else {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        /* Load user role from Firestore after successful login */
        const userDoc = await db.collection("users").doc(user.uid).get();

        if (!userDoc.exists) {
    showMessage("Account created successfully.", "success");
    setLoading(false);
    return;
}

        const userData = userDoc.data();

        localStorage.setItem("currentUser", email);
        localStorage.setItem("currentRole", userData.role);

        showMessage("Login successful.", "success");
        redirectUser(userData.role);
      }
    } catch (error) {
      console.error("Firebase Auth Error:", error);

      /* More user-friendly error messages */
      if (error.code === "auth/email-already-in-use") {
        showMessage("This email is already registered.");
      } else if (error.code === "auth/invalid-email") {
        showMessage("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        showMessage("Password is too weak.");
      } else if (error.code === "auth/user-not-found") {
        showMessage("No account found with this email.");
      } else if (error.code === "auth/wrong-password") {
        showMessage("Incorrect password.");
      } else if (error.code === "auth/invalid-credential") {
        showMessage("Invalid email or password.");
      } else {
        showMessage(error.message);
      }
      setLoading(false);
    }
  });
}