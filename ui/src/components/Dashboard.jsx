import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  DollarSign, 
  Zap, 
  Shield, 
  Settings, 
  Play, 
  Square, 
  Bell,
  MapPin,
  Clock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  TestTube
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:3001/api`;

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-start justify-between hover:bg-slate-900/80 transition-colors group">
    <div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
      {subtext && <p className={`text-xs mt-1 ${color}`}>{subtext}</p>}
    </div>
    <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${color} group-hover:scale-110 transition-transform`}>
      <Icon size={20} />
    </div>
  </div>
);

const LogItem = ({ type, message, time, platform, id }) => {
  const getColors = () => {
    switch(type) {
      case 'success': return 'text-green-400 border-green-500/30 bg-green-500/5';
      case 'error': return 'text-red-400 border-red-500/30 bg-red-500/5';
      case 'warning': return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
      default: return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
    }
  };

  return (
    <div className={`flex flex-col gap-1 border-l-2 pl-3 py-2 text-xs font-mono mb-2 ${getColors()}`}>
      <div className="flex justify-between items-center opacity-70">
        <span>[{platform || 'SYSTEM'}] {id && `#${id}`}</span>
        <span>{time}</span>
      </div>
      <span className="font-semibold">{message}</span>
    </div>
  );
};

const Dashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState({
    baseHourly: 0,
    travelRate: 0,
    fieldNationEnabled: false,
    workMarketEnabled: false,
    testMode: true,
    // Advanced settings
    minPayWM: 0,
    minPayFN: 0,
    workStart: "09:00",
    workEnd: "19:00",
    bufferMinutes: 30,
    avgSpeed: 50,
    travelThreshold: 30
  });

  const [stats, setStats] = useState({
    processed: 0,
    successRate: '100%',
    avgResponse: '0s',
    uptime: '0h'
  });

  // Initial load
  useEffect(() => {
    fetch(`${API_BASE}/status`)
      .then(res => res.json())
      .then(data => {
        setIsMonitoring(data.isMonitoring);
        const newCfg = {
          baseHourly: data.config?.RATES?.BASE_HOURLY_RATE || 0,
          travelRate: data.config?.RATES?.TRAVEL_RATE || 0,
          fieldNationEnabled: data.config?.FIELDNATION_ENABLED || false,
          workMarketEnabled: data.config?.WORKMARKET_ENABLED || false,
          testMode: data.config?.TEST_MODE ?? true,
          minPayWM: data.config?.RATES?.MIN_PAY_THRESHOLD_WORKMARKET || 0,
          minPayFN: data.config?.RATES?.MIN_PAY_THRESHOLD_FIELDNATION || 0,
          workStart: data.config?.TIME?.WORK_START_TIME || "09:00",
          workEnd: data.config?.TIME?.WORK_END_TIME || "19:00",
          bufferMinutes: data.config?.TIME?.BUFFER_MINUTES || 30,
          avgSpeed: data.config?.DISTANCE?.AVERAGE_SPEED || 50,
          travelThreshold: data.config?.DISTANCE?.TRAVEL_THRESHOLD_MILES || 30
        };
        setConfig(newCfg);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch status:", err);
        setIsLoading(false);
      });
  }, []);

  // Poll for events
  useEffect(() => {
    const timer = setInterval(() => {
      fetch(`${API_BASE}/events`)
        .then(res => res.json())
        .then(data => {
          setEvents(data);
          if (data.length > 0) {
              setStats(prev => ({ ...prev, processed: data.length }));
          }
        })
        .catch(err => console.error("Event fetch failed:", err));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const updateBackendConfig = async (updatedConfig) => {
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RATES: {
            BASE_HOURLY_RATE: updatedConfig.baseHourly,
            TRAVEL_RATE: updatedConfig.travelRate,
            MIN_PAY_THRESHOLD_WORKMARKET: updatedConfig.minPayWM,
            MIN_PAY_THRESHOLD_FIELDNATION: updatedConfig.minPayFN
          },
          TIME: {
            WORK_START_TIME: updatedConfig.workStart,
            WORK_END_TIME: updatedConfig.workEnd,
            BUFFER_MINUTES: updatedConfig.bufferMinutes
          },
          DISTANCE: {
            AVERAGE_SPEED: updatedConfig.avgSpeed,
            TRAVEL_THRESHOLD_MILES: updatedConfig.travelThreshold
          },
          FIELDNATION_ENABLED: updatedConfig.fieldNationEnabled,
          WORKMARKET_ENABLED: updatedConfig.workMarketEnabled,
          TEST_MODE: updatedConfig.testMode
        })
      });
    } catch (err) {
      console.error("Failed to update backend config:", err);
    }
  };

  const handleConfigChange = (key, value, isNumeric = true) => {
    const val = isNumeric ? Number(value) : value;
    if (isNumeric && isNaN(val)) return;

    const updated = { ...config, [key]: val };
    setConfig(updated);
    updateBackendConfig(updated);
  };

  const toggleConfig = (key) => {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    updateBackendConfig(updated);
  };

  const toggleMonitoring = async () => {
    const action = isMonitoring ? 'stop' : 'start';
    try {
      const response = await fetch(`${API_BASE}/monitor/${action}`, { method: 'POST' });
      const data = await response.json();
      setIsMonitoring(data.isMonitoring);
    } catch (err) {
      alert('❌ Failed to change monitoring status');
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 text-blue-500 flex flex-col items-center justify-center font-mono gap-4">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      <span className="animate-pulse">Initializing FieldOps Automator...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100 leading-none">FieldOps <span className="text-blue-500">Automator</span></h1>
              <p className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">Autonomous Ops Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isMonitoring ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{isMonitoring ? 'Monitoring' : 'Idle'}</span>
            </div>
            <button
              onClick={toggleMonitoring}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 ${
                isMonitoring
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 shadow-red-900/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20'
              }`}
            >
              {isMonitoring ? <><Square size={16} fill="currentColor" /> Stop Agent</> : <><Play size={16} fill="currentColor" /> Start Agent</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Events" value={stats.processed} subtext="Lifetime session count" icon={CheckCircle2} color="text-emerald-400" />
          <StatCard title="Success Rate" value={stats.successRate} subtext="Response validation" icon={Activity} color="text-blue-400" />
          <StatCard title="Avg Latency" value={stats.avgResponse} subtext="API Roundtrip" icon={Zap} color="text-amber-400" />
          <StatCard title="System Mode" value={config.testMode ? 'TESTING' : 'LIVE'} subtext={config.testMode ? 'Dry-run active' : 'Real-world active'} icon={config.testMode ? TestTube : Cpu} color={config.testMode ? "text-purple-400" : "text-red-400"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/20">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                <Terminal size={16} className="text-slate-500" />
                Live Event Stream
              </h2>
            </div>
            <div className="flex-1 p-4 bg-slate-950/50 min-h-[500px] max-h-[700px] overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-slate-800">
               <div className="space-y-1">
                  {events.length === 0 ? (
                    <div className="text-slate-700 italic text-xs p-4">Waiting for monitoring events...</div>
                  ) : (
                    events.map((ev, i) => <LogItem key={i} {...ev} />)
                  )}
               </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/20">
              <div className="p-4 border-b border-slate-800 bg-slate-950">
                <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                  <Settings size={16} className="text-slate-500" />
                  Global Configuration
                </h2>
              </div>

              <div className="p-5 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rate Thresholds</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg group">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Base Rate</span>
                      <input
                        type="number"
                        value={config.baseHourly}
                        onChange={(e) => handleConfigChange('baseHourly', e.target.value)}
                        className="bg-transparent font-mono font-bold text-xl w-full focus:outline-none focus:text-blue-400 text-slate-200"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg group">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Travel Rate</span>
                      <input
                        type="number"
                        value={config.travelRate}
                        onChange={(e) => handleConfigChange('travelRate', e.target.value)}
                        className="bg-transparent font-mono font-bold text-xl w-full focus:outline-none focus:text-blue-400 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Platforms</label>
                    <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-[10px] font-bold text-blue-500 uppercase hover:underline flex items-center gap-1"
                    >
                      {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                    </button>
                  </div>
                  
                  <ToggleButton label="FieldNation" active={config.fieldNationEnabled} onClick={() => toggleConfig('fieldNationEnabled')} color="blue" />
                  <ToggleButton label="WorkMarket" active={config.workMarketEnabled} onClick={() => toggleConfig('workMarketEnabled')} color="emerald" />

                  {showAdvanced && (
                    <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="h-px bg-slate-800 my-2" />
                      
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <DollarSign size={10} />
                           Min Total Pay
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">FieldNation</span>
                            <input 
                              type="number" 
                              value={config.minPayFN} 
                              onChange={(e) => handleConfigChange('minPayFN', e.target.value)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300" 
                            />
                          </div>
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">WorkMarket</span>
                            <input 
                              type="number" 
                              value={config.minPayWM} 
                              onChange={(e) => handleConfigChange('minPayWM', e.target.value)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Clock size={10} />
                           Work Schedule
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">Start</span>
                            <input 
                              type="time" 
                              value={config.workStart} 
                              onChange={(e) => handleConfigChange('workStart', e.target.value, false)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300 invert brightness-200 contrast-100" 
                            />
                          </div>
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">End</span>
                            <input 
                              type="time" 
                              value={config.workEnd} 
                              onChange={(e) => handleConfigChange('workEnd', e.target.value, false)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300 invert brightness-200 contrast-100" 
                            />
                          </div>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                          <span className="text-[9px] text-slate-500 uppercase block mb-0.5">Buffer Between Jobs (min)</span>
                          <input 
                            type="number" 
                            value={config.bufferMinutes} 
                            onChange={(e) => handleConfigChange('bufferMinutes', e.target.value)}
                            className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300" 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <MapPin size={10} />
                           Travel Settings
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">Avg Speed</span>
                            <input 
                              type="number" 
                              value={config.avgSpeed} 
                              onChange={(e) => handleConfigChange('avgSpeed', e.target.value)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300" 
                            />
                          </div>
                          <div className="bg-slate-950/50 border border-slate-800/50 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-500 uppercase block mb-0.5">Radius (mi)</span>
                            <input 
                              type="number" 
                              value={config.travelThreshold} 
                              onChange={(e) => handleConfigChange('travelThreshold', e.target.value)}
                              className="bg-transparent font-mono text-sm w-full focus:outline-none text-slate-300" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-slate-800 my-2" />

                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Mode</label>
                  <ToggleButton
                    label="Test Mode (Dry Run)"
                    active={config.testMode}
                    onClick={() => toggleConfig('testMode')}
                    color="purple"
                    icon={TestTube}
                  />
                </div>

                <div className="pt-2 text-[10px] text-slate-500 italic text-center">
                    Config changes are applied in real-time (no Apply button needed).
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const ToggleButton = ({ label, active, onClick, color, icon: Icon }) => {
    const colors = {
        blue: active ? 'bg-blue-500/10 border-blue-500/40 text-blue-100' : 'bg-slate-950 border-slate-800 text-slate-500',
        emerald: active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100' : 'bg-slate-950 border-slate-800 text-slate-500',
        purple: active ? 'bg-purple-500/10 border-purple-500/40 text-purple-100' : 'bg-slate-950 border-slate-800 text-slate-500',
    };

    return (
        <div
            onClick={onClick}
            className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all ${colors[color]}`}
        >
            <div className="flex items-center gap-3">
                {Icon && <Icon size={14} />}
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? `bg-${color}-600` : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-4' : 'left-1'}`} />
            </div>
        </div>
    );
};

export default Dashboard;
