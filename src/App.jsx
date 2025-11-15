import React from "react";
import { useAuth } from "react-oidc-context";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

import TokenViewer from "./pages/TokenViewer";
import FrostThingCreator from "./pages/FrostThingCreator";
import SoundMap from "./pages/SoundMap";

// 🔥 Component แยกเพื่อใช้ useNavigate
function AuthenticatedApp({ auth, idToken, signOutRedirect }) {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen flex flex-col">
      <Routes>
        <Route 
          path="/" 
          element={
            <SoundMap 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onNavigateToHome={() => navigate('/')}
              onNavigateToMyThing={() => navigate('/things')}
              onNavigateToNewDevice={() => navigate('/create-thing')}
              onNavigateToUpload={() => alert('Upload feature - coming soon')}
              onSignOut={signOutRedirect}
            />
          } 
        />
        <Route 
          path="/token" 
          element={<TokenViewer auth={auth} />} 
        />
        <Route 
          path="/create-thing" 
          element={
            <FrostThingCreator 
              idToken={idToken}
              onBack={() => navigate('/')}
            />
          }
        />
        <Route 
          path="/things" 
          element={
            <SoundMap 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onNavigateToHome={() => navigate('/')}
              onNavigateToMyThing={() => navigate('/things')}
              onNavigateToNewDevice={() => navigate('/create-thing')}
              onNavigateToUpload={() => alert('Upload feature - coming soon')}
              onSignOut={signOutRedirect}
            />
          } 
        />
      </Routes>
    </div>
  );
}

function App() {
  const auth = useAuth();

  // ค่า Cognito ของคุณ
  const clientId = "1jceblsgd204cslnvhtdp8b4k4";
  const logoutUri = "http://localhost:3000";
  const cognitoDomain = "https://us-east-192ay6occq.auth.us-east-1.amazoncognito.com";

  const signOutRedirect = () => {
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  // กำลังโหลด session
  if (auth.isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin border-t-4 border-blue-600 border-solid rounded-full w-16 h-16 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // มี error จาก OIDC
  if (auth.error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h1 className="text-red-600 text-xl font-bold mb-4">Authentication Error</h1>
          <p className="text-gray-700">{auth.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ถ้าล็อกอินแล้ว
  if (auth.isAuthenticated) {
    const idToken = auth.user?.id_token;

    return (
      <Router>
        <AuthenticatedApp 
          auth={auth} 
          idToken={idToken} 
          signOutRedirect={signOutRedirect}
        />
      </Router>
    );
  }

  // ถ้ายังไม่ล็อกอิน
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
      <div className="bg-white p-12 rounded-2xl shadow-2xl text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">DataAPI</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>
        
        <button 
          onClick={() => auth.signinRedirect()}
          className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Sign in with Cognito
        </button>
        
        <p className="mt-6 text-sm text-gray-500">
          Secure authentication powered by AWS Cognito
        </p>
      </div>
    </div>
  );
}

export default App;