// src/UserPool.jsx
import React from "react";
import { CognitoUserPool } from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: "us-east-1_evK4TU61v", // 🔹 ใส่ User Pool ID ของคุณ
  ClientId: "3fv6klp298hleal8bgvq4136m9", // 🔹 ใส่ App Client ID ของคุณ
};

const UserPool = new CognitoUserPool(poolData);

export default UserPool;

