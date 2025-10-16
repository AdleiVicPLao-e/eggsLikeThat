import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./styles/global.css";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    console.error("Error caught by boundary:", error, errorInfo);

    // Send to analytics if available
    if (window.gtag) {
      gtag("event", "exception", {
        description: error.message,
        fatal: true,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
            <div className="text-6xl mb-4">😿</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-6">
              We're sorry, but something went wrong. Please try refreshing the
              page.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                Refresh Page
              </button>
              <button
                onClick={() =>
                  this.setState({
                    hasError: false,
                    error: null,
                    errorInfo: null,
                  })
                }
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-gray-400 text-sm">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-3 bg-gray-900 rounded text-xs">
                  <div className="text-red-400 font-mono mb-2">
                    {this.state.error?.toString()}
                  </div>
                  <pre className="text-gray-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Remove loading screen when app is ready
const removeLoadingScreen = () => {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.style.opacity = "0";
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById("root"));

try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Remove loading screen after render
  setTimeout(removeLoadingScreen, 1000);
} catch (error) {
  console.error("Failed to render app:", error);
  removeLoadingScreen();
}

// Performance monitoring in production
if (import.meta.env.PROD) {
  // Load web vitals
  import("web-vitals").then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    const reportWebVitals = (metric) => {
      // Report to analytics if available
      if (window.gtag) {
        gtag("event", "web_vitals", {
          event_category: "Web Vitals",
          event_label: metric.name,
          value: Math.round(
            metric.name === "CLS" ? metric.value * 1000 : metric.value
          ),
          non_interaction: true,
        });
      }
    };

    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  });
}
