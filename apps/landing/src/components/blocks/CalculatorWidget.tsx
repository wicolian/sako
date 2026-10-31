"use client";

import { useState, useMemo } from "react";

type CurrentSetup = "in-house" | "freelancers" | "agency" | "none";
type SakoPlan = "core" | "ops-base" | "enterprise";
type CostMode = "salary-only" | "fully-loaded";
type DisplayCurrency = "USD" | "EUR" | "INR";

interface MarketDefaults {
  // IMPORTANT: These are USD benchmarks (not local currency)
  designerSalaryUSD: number;
  motionEditorSalaryUSD: number;
  overheadPercent: number;
  toolsCostUSD: number;
  managerHourlyRateUSD: number;
}

// Market = benchmark, not currency.
const marketDefaults: Record<string, MarketDefaults> = {
  usa: {
    designerSalaryUSD: 95000,
    motionEditorSalaryUSD: 85000,
    overheadPercent: 30,
    toolsCostUSD: 6000,
    managerHourlyRateUSD: 100,
  },
  eu: {
    designerSalaryUSD: 70000,
    motionEditorSalaryUSD: 65000,
    overheadPercent: 35,
    toolsCostUSD: 5000,
    managerHourlyRateUSD: 80,
  },
  india: {
    designerSalaryUSD: 22000,
    motionEditorSalaryUSD: 18000,
    overheadPercent: 20,
    toolsCostUSD: 3600,
    managerHourlyRateUSD: 40,
  },
};

const marketToCurrency: Record<string, DisplayCurrency> = {
  usa: "USD",
  eu: "EUR",
  india: "INR",
};

const localeForCurrency: Record<DisplayCurrency, string> = {
  USD: "en-US",
  EUR: "de-DE",
  INR: "en-IN",
};

const planPrices: Record<SakoPlan, number> = {
  core: 2500,
  'ops-base': 4500,
  enterprise: 8500,
};

const planThroughput: Record<SakoPlan, { min: number; max: number; default: number }> = {
  core: { min: 8, max: 12, default: 10 },
  'ops-base': { min: 16, max: 24, default: 20 },
  enterprise: { min: 24, max: 40, default: 30 },
};

interface CalculatorWidgetProps {
  title?: string;
  subtitle?: string;
}

export function CalculatorWidget({ title, subtitle }: CalculatorWidgetProps) {
  const [currentSetup, setCurrentSetup] = useState<CurrentSetup>("in-house");
  const [market, setMarket] = useState("usa");
  const [sakoPlan, setSakoPlan] = useState<SakoPlan>("ops-base");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [costMode, setCostMode] = useState<CostMode>("salary-only");
  
  // Inputs are treated as USD (keeps it consistent with plan prices).
  const [projectsPerMonth, setProjectsPerMonth] = useState(5);
  const [avgProjectCostUSD, setAvgProjectCostUSD] = useState(3000);
  const [monthlyRetainerUSD, setMonthlyRetainerUSD] = useState(10000);

  // Throughput inputs
  const [currentTasksPerMonth, setCurrentTasksPerMonth] = useState(8);
  const [sakoTasksPerMonth, setSakoTasksPerMonth] = useState(planThroughput['ops-base'].default);

  // Display currency derived from market, but user-visible conversion.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");

  // FX = how much 1 USD is in that currency (USD->X).
  // Defaults are just defaults. User can change.
  const [usdToEur, setUsdToEur] = useState(0.92);
  const [usdToInr, setUsdToInr] = useState(83);
  
  
  const defaults = marketDefaults[market] || marketDefaults.usa;

  // Keep display currency synced with market (optional but usually expected).
  // If you want user-controlled currency, remove this and add a selector.
  useMemo(() => {
    setDisplayCurrency(marketToCurrency[market] || "USD");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  // Update Sako throughput when plan changes
  useMemo(() => {
    setSakoTasksPerMonth(planThroughput[sakoPlan].default);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sakoPlan]);

  const fxRate = (currency: DisplayCurrency) => {
    if (currency === "USD") return 1;
    if (currency === "EUR") return usdToEur;
    return usdToInr;
  };

  const formatMoneyFromUSD = (valueUSD: number) => {
    const rate = fxRate(displayCurrency);
    const value = valueUSD * rate;

    return new Intl.NumberFormat(localeForCurrency[displayCurrency], {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const results = useMemo(() => {
    let currentAnnualCostUSD = 0;
    let breakdownUSD = { salary: 0, overhead: 0, tools: 0, management: 0 };
    
    if (currentSetup === "in-house") {
      const baseSalaryUSD = defaults.designerSalaryUSD + defaults.motionEditorSalaryUSD;
      const overheadUSD = costMode === "fully-loaded" ? baseSalaryUSD * (defaults.overheadPercent / 100) : 0;
      const toolsUSD = costMode === "fully-loaded" ? defaults.toolsCostUSD : 0;
      const managementUSD = costMode === "fully-loaded" ? 10 * defaults.managerHourlyRateUSD * 12 : 0;

      breakdownUSD = {
        salary: baseSalaryUSD,
        overhead: overheadUSD,
        tools: toolsUSD,
        management: managementUSD,
      };

      currentAnnualCostUSD = baseSalaryUSD + overheadUSD + toolsUSD + managementUSD;
    }
    
    if (currentSetup === "freelancers") {
      currentAnnualCostUSD = avgProjectCostUSD * projectsPerMonth * 12;
    }
    
    if (currentSetup === "agency") {
      currentAnnualCostUSD = monthlyRetainerUSD * 12;
    }

    // none => 0
    
    let sakoMonthlyUSD = planPrices[sakoPlan];
    if (billingCycle === "annual") sakoMonthlyUSD *= 0.9; // 10% discount, not 15%
    
    const sakoAnnualCostUSD = sakoMonthlyUSD * 12;
    const annualDifferenceUSD = currentAnnualCostUSD - sakoAnnualCostUSD;

    // Throughput calculations
    const sakoCostPerTaskUSD = sakoTasksPerMonth > 0 ? sakoAnnualCostUSD / (sakoTasksPerMonth * 12) : 0;
    const currentCostPerTaskUSD = currentTasksPerMonth > 0 ? currentAnnualCostUSD / (currentTasksPerMonth * 12) : 0;
    const extraTasksPerMonth = sakoTasksPerMonth - currentTasksPerMonth;
    
    return {
      currentAnnualCostUSD,
      sakoAnnualCostUSD,
      annualDifferenceUSD,
      breakdownUSD,
      sakoCostPerTaskUSD,
      currentCostPerTaskUSD,
      extraTasksPerMonth,
    };
  }, [
    currentSetup,
    defaults,
    costMode,
    avgProjectCostUSD,
    projectsPerMonth,
    monthlyRetainerUSD,
    sakoPlan,
    billingCycle,
    currentTasksPerMonth,
    sakoTasksPerMonth,
  ]);
  
  
  return (
    <section className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">{title}</h2>}
            {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <h3 className="font-semibold text-lg mb-6">Your Current Setup</h3>
            
            {/* Current setup selector */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Current design setup</label>
              <div className="grid grid-cols-2 gap-2">
                {(['in-house', 'freelancers', 'agency', 'none'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setCurrentSetup(option)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      currentSetup === option
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {option === 'in-house' ? 'In-House' : option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Market benchmark</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AE83E]"
              >
                <option value="usa">USA</option>
                <option value="eu">Europe</option>
                <option value="india">India</option>
              </select>
              <div className="text-xs text-gray-500 mt-2">
                Benchmarks are stored in USD. We convert for display.
              </div>
            </div>

            {/* FX input only when not USD */}
            {displayCurrency !== "USD" && (
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Exchange rate (1 USD = ? {displayCurrency})
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={displayCurrency === "EUR" ? usdToEur : usdToInr}
                  onChange={(e) =>
                    displayCurrency === "EUR" ? setUsdToEur(Number(e.target.value)) : setUsdToInr(Number(e.target.value))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AE83E]"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Adjust to your rate so {displayCurrency} totals look realistic.
                </div>
              </div>
            )}

            {/* Cost calculation mode */}
            {currentSetup === 'in-house' && (
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Cost calculation</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCostMode('salary-only')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      costMode === 'salary-only'
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Salary Only
                  </button>
                  <button
                    onClick={() => setCostMode('fully-loaded')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      costMode === 'fully-loaded'
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Fully Loaded
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {costMode === "salary-only"
                    ? `Base salaries only (${formatMoneyFromUSD(defaults.designerSalaryUSD + defaults.motionEditorSalaryUSD)})`
                    : `Salary + overhead + tools + management (more realistic for finance)`}
                </div>
              </div>
            )}
            
            {/* Conditional inputs */}
            {currentSetup === 'freelancers' && (
              <>
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Projects per month</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={projectsPerMonth}
                    onChange={(e) => setProjectsPerMonth(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-right text-sm text-gray-500 mt-1">{projectsPerMonth} projects</div>
                </div>
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Avg project cost (USD)</label>
                  <input
                    type="number"
                    value={avgProjectCostUSD}
                    onChange={(e) => setAvgProjectCostUSD(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AE83E]"
                  />
                </div>
              </>
            )}
            
            {currentSetup === 'agency' && (
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Monthly retainer (USD)</label>
                <input
                  type="number"
                  value={monthlyRetainerUSD}
                  onChange={(e) => setMonthlyRetainerUSD(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AE83E]"
                />
              </div>
            )}
            
            <hr className="my-6 border-gray-200" />
            
            {/* Sako plan */}
            <h3 className="font-semibold text-lg mb-6">Sako Plan</h3>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(['core', 'ops-base', 'enterprise'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => setSakoPlan(plan)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    sakoPlan === plan
                      ? 'bg-[#9AE83E] text-black'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {plan === 'ops-base' ? 'Ops Base' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                </button>
              ))}
            </div>

            {/* Throughput assumptions */}
            <div className="mt-6">
              <h4 className="font-semibold text-sm mb-3">Throughput assumptions</h4>

              <label className="text-sm text-gray-700 block mb-2">Your current shipped tasks / month</label>
              <input
                type="number"
                value={currentTasksPerMonth}
                onChange={(e) => setCurrentTasksPerMonth(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AE83E]"
              />

              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">
                  Typical {sakoPlan === "enterprise" ? "Enterprise (custom)" : "Sako"} range:{" "}
                  {planThroughput[sakoPlan].min}–{planThroughput[sakoPlan].max} standard tasks/mo
                </div>

                <label className="text-sm text-gray-700 block mb-2">Assumed Sako tasks / month</label>
                <input
                  type="range"
                  min={planThroughput[sakoPlan].min}
                  max={planThroughput[sakoPlan].max}
                  value={sakoTasksPerMonth}
                  onChange={(e) => setSakoTasksPerMonth(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-right text-sm text-gray-500 mt-1">{sakoTasksPerMonth} tasks</div>
              </div>
            </div>
            
            {/* Billing cycle */}
            <div className="flex gap-2">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-black text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  billingCycle === "annual" ? "bg-black text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Annual (10% off)
              </button>
            </div>
          </div>
          
          {/* Results */}
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-8">
            <h3 className="font-semibold text-lg mb-8">Your Savings</h3>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">Current annual cost</span>
                <span className="text-2xl font-bold">{formatMoneyFromUSD(results.currentAnnualCostUSD)}</span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">Sako annual cost</span>
                <span className="text-2xl font-bold text-[#9AE83E]">{formatMoneyFromUSD(results.sakoAnnualCostUSD)}</span>
              </div>
              
              <div className="bg-[#9AE83E]/10 rounded-2xl p-6 text-center">
                <div className="text-sm text-[#9AE83E] mb-2">
                  {results.annualDifferenceUSD >= 0 ? "Annual Savings" : "Additional Annual Cost"}
                </div>

                <div className="text-4xl font-bold text-[#9AE83E] mb-2">
                  {formatMoneyFromUSD(Math.abs(results.annualDifferenceUSD))}
                </div>

                {results.currentAnnualCostUSD > 0 && (
                  <div className="text-sm text-gray-400">
                    {Math.abs((results.annualDifferenceUSD / results.currentAnnualCostUSD) * 100).toFixed(0)}%
                    {results.annualDifferenceUSD >= 0 ? " less than current" : " more than current"}
                  </div>
                )}

                {results.currentAnnualCostUSD === 0 && results.annualDifferenceUSD < 0 && (
                  <div className="text-sm text-gray-400">
                    You're currently spending 0. This is added spend for speed + capacity.
                  </div>
                )}
              </div>

              {currentSetup === "in-house" && results.breakdownUSD.salary > 0 && (
                <div className="bg-white/5 rounded-xl p-4 mt-6">
                  <div className="text-sm font-medium text-white mb-3">Cost breakdown</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base salaries</span>
                      <span>{formatMoneyFromUSD(results.breakdownUSD.salary)}</span>
                    </div>

                    {results.breakdownUSD.overhead > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Overhead ({defaults.overheadPercent}%)</span>
                        <span>{formatMoneyFromUSD(results.breakdownUSD.overhead)}</span>
                      </div>
                    )}

                    {results.breakdownUSD.tools > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tools & software</span>
                        <span>{formatMoneyFromUSD(results.breakdownUSD.tools)}</span>
                      </div>
                    )}

                    {results.breakdownUSD.management > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Management time</span>
                        <span>{formatMoneyFromUSD(results.breakdownUSD.management)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Throughput view */}
              <div className="bg-white/5 rounded-xl p-4 mt-6">
                <div className="text-sm font-medium text-white mb-3">Throughput view</div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sako cost per shipped task</span>
                  <span>{formatMoneyFromUSD(results.sakoCostPerTaskUSD)}</span>
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">Current cost per shipped task</span>
                  <span>{formatMoneyFromUSD(results.currentCostPerTaskUSD)}</span>
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">Extra tasks per month</span>
                  <span className={results.extraTasksPerMonth >= 0 ? "text-[#9AE83E]" : "text-red-300"}>
                    {results.extraTasksPerMonth >= 0 ? "+" : ""}
                    {results.extraTasksPerMonth}
                  </span>
                </div>
              </div>
              
              <a
                href="/pricing"
                className="block w-full text-center py-4 bg-[#9AE83E] text-black font-bold rounded-full hover:bg-white transition-colors mt-6"
              >
                Get Started with Sako
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


