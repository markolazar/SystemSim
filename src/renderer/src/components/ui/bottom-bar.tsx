import React, { useState } from 'react';
import { Button } from './button';

interface ExecutionLog {
    time: string;
    type: 'info' | 'error' | 'success';
    message: string;
}

interface BottomBarProps {
    onStart: () => void;
    onPause: () => void;
    onStop: () => void;
    onReset: () => void;
    isRunning: boolean;
    isPaused: boolean;
    executionLogs?: ExecutionLog[];
    onClearLogs?: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
    onStart,
    onPause,
    onStop,
    onReset,
    isRunning,
    isPaused,
    executionLogs = [],
    onClearLogs
}) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`relative transition-all duration-300 ${collapsed ? 'h-8' : 'h-20'} bg-white dark:bg-slate-950 border-t border-gray-300 dark:border-gray-700 flex items-center px-4`}
            style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' }}
        >
            <button
                className="absolute left-1/2 -top-4 transform -translate-x-1/2 bg-gray-200 dark:bg-gray-800 rounded-full px-2 py-1 text-xs shadow border border-gray-300 dark:border-gray-700"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expand bar' : 'Collapse bar'}
                style={{ zIndex: 41 }}
            >
                {collapsed ? '▲' : '▼'}
            </button>
            {!collapsed && (
                <div className="flex gap-4 w-full items-center">
                    {/* Execution Log Display */}
                    {executionLogs.length > 0 && (
                        <div className="flex-1 flex flex-col gap-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 max-h-16 overflow-y-auto">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                    Execution Log
                                </span>
                                {onClearLogs && (
                                    <button
                                        onClick={onClearLogs}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg font-bold leading-none"
                                        title="Clear logs"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 font-mono text-xs">
                                {executionLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-gray-500 dark:text-gray-500 whitespace-nowrap">[{log.time}]</span>
                                        <span className={
                                            log.type === 'error' ? 'text-red-500' :
                                                log.type === 'success' ? 'text-green-500' :
                                                    'text-blue-500'
                                        }>
                                            {log.message}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Control Buttons - Right Side */}
                    <div className="flex gap-2 ml-auto">
                        <Button
                            onClick={onStart}
                            disabled={isRunning}
                            variant="default"
                            size="sm"
                            className="min-w-[80px]"
                        >
                            ▶️ Start
                        </Button>
                        {/* Pause button commented out for future use */}
                        {/* <Button
                            onClick={onPause}
                            disabled={!isRunning || isPaused}
                            variant="outline"
                            size="sm"
                            className="min-w-[80px]"
                        >
                            ⏸️ Pause
                        </Button> */}
                        <Button
                            onClick={onStop}
                            disabled={!isRunning}
                            variant="destructive"
                            size="sm"
                            className="min-w-[80px]"
                        >
                            ⏹️ Stop
                        </Button>
                        <Button
                            onClick={onReset}
                            disabled={isRunning}
                            variant="outline"
                            size="sm"
                            className="min-w-[80px]"
                        >
                            🔄 Reset
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
