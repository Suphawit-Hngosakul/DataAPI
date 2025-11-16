import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

import NewDataset from "./pages/NewDataset";
import FrostThingCreator from "./pages/FrostThingCreator";
import SoundMap from "./pages/SoundMap";
import AddFeature from "./pages/AddFeature";

function AuthenticatedApp({ auth, idToken, signOutRedirect }) {
  const navigate = useNavigate();
  const [selectedDatasetForLayer, setSelectedDatasetForLayer] = useState(null);
  const [selectedLayerForFeature, setSelectedLayerForFeature] = useState(null);

  // Handler สำหรับการเพิ่ม layer ใน dataset ที่มีอยู่
  const handleNavigateToNewLayer = (datasetInfo) => {
    console.log('Navigate to new layer with:', datasetInfo);
    setSelectedDatasetForLayer(datasetInfo);
    navigate('/new-dataset');
  };

  // Handler สำหรับการเพิ่ม feature ใน layer ที่มีอยู่
  const handleNavigateToAddFeature = (featureInfo) => {
    console.log('Navigate to add feature with:', featureInfo);
    setSelectedLayerForFeature(featureInfo);
    navigate('/add-feature');
  };

  // Handler สำหรับ complete dataset/layer
  const handleCompleteDataset = () => {
    setSelectedDatasetForLayer(null);
    navigate('/');
  };

  // Handler สำหรับ cancel dataset/layer
  const handleCancelDataset = () => {
    setSelectedDatasetForLayer(null);
    navigate('/');
  };

  // Handler สำหรับ complete feature
  const handleCompleteFeature = () => {
    setSelectedLayerForFeature(null);
    navigate('/');
  };

  // Handler สำหรับ cancel feature
  const handleCancelFeature = () => {
    setSelectedLayerForFeature(null);
    navigate('/');
  };

  return (
    <div className="w-full h-screen flex flex-col">
      <Routes>
        {/* Main Map Route */}
        <Route 
          path="/" 
          element={
            <SoundMap 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onNavigateToHome={() => navigate('/')}
              onNavigateToMyThing={() => navigate('/things')}
              onNavigateToNewDevice={() => navigate('/create-thing')}
              onNavigateToNewDataset={() => {
                setSelectedDatasetForLayer(null);
                navigate('/new-dataset');
              }}
              onNavigateToNewLayer={handleNavigateToNewLayer}
              onNavigateToAddFeature={handleNavigateToAddFeature}
              onNavigateToUpload={() => alert('Upload feature - coming soon')}
              signOutRedirect={signOutRedirect}
            />
          } 
        />

        {/* Create Thing Route */}
        <Route 
          path="/create-thing" 
          element={
            <FrostThingCreator 
              idToken={idToken}
              onBack={() => navigate('/')}
            />
          }
        />

        {/* Things Route */}
        <Route 
          path="/things" 
          element={
            <SoundMap 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onNavigateToHome={() => navigate('/')}
              onNavigateToMyThing={() => navigate('/things')}
              onNavigateToNewDevice={() => navigate('/create-thing')}
              onNavigateToNewDataset={() => {
                setSelectedDatasetForLayer(null);
                navigate('/new-dataset');
              }}
              onNavigateToNewLayer={handleNavigateToNewLayer}
              onNavigateToAddFeature={handleNavigateToAddFeature}
              onNavigateToUpload={() => alert('Upload feature - coming soon')}
              signOutRedirect={signOutRedirect}
            />
          } 
        />

        {/* New Dataset / Add Layer Route */}
        <Route 
          path="/new-dataset" 
          element={
            <NewDataset 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onCancel={handleCancelDataset}
              onComplete={handleCompleteDataset}
              existingDataset={selectedDatasetForLayer}
            />
          } 
        />

        {/* Add Feature Route */}
        <Route 
          path="/add-feature" 
          element={
            <AddFeature 
              idToken={idToken}
              userEmail={auth.user?.profile?.email || auth.user?.profile?.sub}
              onCancel={handleCancelFeature}
              onComplete={handleCompleteFeature}
              {...selectedLayerForFeature}
            />
          } 
        />
      </Routes>
    </div>
  );
}

function App() {
  const auth = useAuth();

  const clientId = "1jceblsgd204cslnvhtdp8b4k4";
  const logoutUri = "http://localhost:3000";
  const cognitoDomain = "https://us-east-192ay6occq.auth.us-east-1.amazoncognito.com";

  const signOutRedirect = () => {
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  // Loading State
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

  // Error State
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

  // Authenticated State
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

  // Login Screen
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