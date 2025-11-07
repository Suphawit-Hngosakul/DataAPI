import React, { useState } from 'react';
import SoundMap from './map';
import FrostThingCreator from './FrostThingCreator';
import Upload from './Upload';

function App() {
  const [currentPage, setCurrentPage] = useState('map');

  return (
    <div>
      {currentPage === 'map' && (
        <SoundMap 
          onNavigateToNewDevice={() => setCurrentPage('frost')}
          onNavigateToUpload={() => setCurrentPage('upload')}
        />
      )}
      {currentPage === 'frost' && (
        <FrostThingCreator onNavigateBack={() => setCurrentPage('map')} />
      )}
      {currentPage === 'upload' && (
        <Upload onNavigateBack={() => setCurrentPage('map')} />
      )}
    </div>
  );
}

export default App;