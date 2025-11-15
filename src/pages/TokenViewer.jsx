import React from "react";

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch (e) {
    return { error: "decode ไม่ได้" };
  }
}

const box = {
  background: "#fff",
  padding: "12px 14px",
  borderRadius: "6px",
  marginBottom: "12px",
  border: "1px solid #ddd",
};

const pre = {
  background: "#f3f3f3",
  padding: "8px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const TokenViewer = ({ auth }) => {
  const idToken = auth.user?.id_token || "";
  const accessToken = auth.user?.access_token || "";
  const refreshToken = auth.user?.refresh_token || "";
  const decoded = decodeJwt(idToken);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2>Cognito Token Viewer</h2>

      <div style={box}>
        <p><strong>profile</strong></p>
        <pre style={pre}>{JSON.stringify(auth.user?.profile, null, 2)}</pre>
      </div>

      <div style={box}>
        <p><strong>id_token</strong></p>
        <pre style={pre}>{idToken || "(ไม่มี)"}</pre>
      </div>

      <div style={box}>
        <p><strong>access_token</strong></p>
        <pre style={pre}>{accessToken || "(ไม่มี)"}</pre>
      </div>

      <div style={box}>
        <p><strong>refresh_token</strong></p>
        <pre style={pre}>{refreshToken || "(ไม่มี)"}</pre>
      </div>

      <div style={box}>
        <p>Decoded id_token payload</p>
        <pre style={pre}>
          {decoded ? JSON.stringify(decoded, null, 2) : "(decode ไม่ได้)"}
        </pre>
      </div>
    </div>
  );
};

export default TokenViewer;
