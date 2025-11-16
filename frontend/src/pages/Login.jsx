import React, { useState } from "react";
import { CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import UserPool from "./UserPool.jsx";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [cognitoUser, setCognitoUser] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();

    const user = new CognitoUser({ Username: email, Pool: UserPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        localStorage.setItem("token", result.getAccessToken().getJwtToken());
        setMessage("✅ Login success!");
        if (typeof onLogin === "function") onLogin();
      },
      onFailure: (err) => setMessage("❌ " + err.message),
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Cognito แจ้งว่าต้องเปลี่ยนรหัส
        setMessage("🔑 You need to set a new password.");
        setShowNewPassword(true);
        setCognitoUser(user);
      },
    });
  };

  const handleSetNewPassword = (e) => {
    e.preventDefault();
    if (!cognitoUser) return;

    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (result) => {
        setMessage("✅ Password updated! You are logged in.");
        setShowNewPassword(false);
        setPassword(newPassword);
        if (typeof onLogin === "function") onLogin();
      },
      onFailure: (err) => setMessage("❌ " + err.message),
    });
  };

  return (
  <div style={styles.wrapper}>
    <div style={styles.container}>
      <h3 style={styles.logintitle}>🔐DataAPI</h3>
      <form style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        {!showNewPassword && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
        )}
        {showNewPassword && (
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
          />
        )}

        {!showNewPassword ? (
          <button onClick={handleLogin} style={styles.button}>Login</button>
        ) : (
          <button onClick={handleSetNewPassword} style={styles.button}>Set New Password</button>
        )}
      </form>
      <p>{message}</p>
    </div>
  </div>
);
}


const styles = {
  container: {
    width: "450px",              // เพิ่มความกว้าง
    padding: "40px",             // เพิ่มช่องว่างภายใน
    backgroundColor: "#fcf085ff",
    borderRadius: "12px",
    boxShadow: "0 0 20px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    textAlign: "center",
  },
   logintitle: {
    fontSize: "60px",    // ต้องใช้ fontSize แทน fontsize
    fontWeight: "bold",  // ต้องใช้ fontWeight แทน fontweight
  },

  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",             // ให้เต็มหน้าจอแนวตั้ง
    backgroundColor: "#fefefeff",  // สีพื้นหลังเบาๆ
  },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  input: {
    padding: "12px",
    fontSize: "18px",
    borderRadius: "6px",
    border: "1px solid #7f7f3fff",
  },
  button: {
    backgroundColor: "#6b05e0ff",
    color: "white",
    padding: "12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  },
};

