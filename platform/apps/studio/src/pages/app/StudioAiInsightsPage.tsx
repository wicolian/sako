import React, { useEffect, useState } from 'react';
import { fetchStudioAiSummary, fetchStudioAiEstimates } from '../../lib/api';
import { StudioAiSummary, StudioAiEstimate } from '../../lib/types';
import { Icon } from '../../components/Icon';

export const StudioAiInsightsPage: React.FC = () => {
    const [summary, setSummary] = useState<StudioAiSummary | null>(null);
    const [estimates, setEstimates] = useState<StudioAiEstimate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([fetchStudioAiSummary(), fetchStudioAiEstimates()])
            .then(([s, e]) => {
                setSummary(s);
                setEstimates(e);
            })
            .catch(err => console.error('Failed to load AI insights', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8">Loading AI Insights...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">AI Readiness Insights</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-500">Structured Brief Adoption</h3>
                    <p className="text-3xl font-bold mt-2">{summary?.percentWithStructuredBrief.toFixed(1)}%</p>
                    <p className="text-sm text-zinc-400 mt-1">{summary?.tasksWithStructuredBrief} / {summary?.totalTasks} tasks</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-500">Avg Revisions</h3>
                    <p className="text-3xl font-bold mt-2">{summary?.avgRevisionCount.toFixed(1)}</p>
                    <p className="text-sm text-zinc-400 mt-1">per task (last 30 days)</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-500">Estimator Accuracy</h3>
                    <p className="text-3xl font-bold mt-2">{summary?.estimatorStats.averageAbsoluteErrorHours.toFixed(1)}h</p>
                    <p className="text-sm text-zinc-400 mt-1">avg absolute error (sample: {summary?.estimatorStats.sampleSize})</p>
                </div>
            </div>

            {/* Asset Breakdown */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-semibold mb-4">Asset Type Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {summary?.assetTypeBreakdown.map((item) => (
                        <div key={item.primaryAssetType} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                            <p className="text-sm font-medium capitalize">{item.primaryAssetType.replace('_', ' ')}</p>
                            <p className="text-xl font-bold mt-1">{item.count}</p>
                        </div>
                    ))}
                    {summary?.assetTypeBreakdown.length === 0 && (
                        <p className="text-zinc-500 text-sm">No structured briefs yet.</p>
                    )}
                </div>
            </div>

            {/* Recent Estimates Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-semibold">Recent Estimates vs Actuals</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">Workspace</th>
                                <th className="px-6 py-3 font-medium">Asset Type</th>
                                <th className="px-6 py-3 font-medium">Est. Hours</th>
                                <th className="px-6 py-3 font-medium">Actual Hours</th>
                                <th className="px-6 py-3 font-medium">Revisions</th>
                                <th className="px-6 py-3 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {estimates.map((est) => (
                                <tr key={est.snapshotId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                    <td className="px-6 py-4 font-medium">{est.workspaceName}</td>
                                    <td className="px-6 py-4 capitalize">{est.primaryAssetType?.replace('_', ' ') || '-'}</td>
                                    <td className="px-6 py-4">{est.estimatedEffortHours}</td>
                                    <td className="px-6 py-4">
                                        {est.actualTurnaroundHours ? est.actualTurnaroundHours.toFixed(1) : '-'}
                                    </td>
                                    <td className="px-6 py-4">{est.revisionCount ?? '-'}</td>
                                    <td className="px-6 py-4 text-zinc-500">{new Date(est.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {estimates.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-zinc-500">No estimates found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
