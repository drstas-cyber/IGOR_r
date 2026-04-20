import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import HomePage from '@/components/HomePage';
import RussianRealtorPage from '@/components/RussianRealtorPage';
import ContactPage from '@/components/ContactPage';

function App() {
  return (
    <>
      <Helmet>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/russian-speaking-realtor-temecula" element={<RussianRealtorPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/contact/" element={<ContactPage />} />
        </Routes>
      </Router>
      
      <Toaster />
    </>
  );
}

export default App;