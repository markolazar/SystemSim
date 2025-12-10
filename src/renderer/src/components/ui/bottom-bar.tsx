import React, { useState } from 'react';
import { Button } from './button';

interface BottomBarProps {
    onStart: () => void;
    onPause: () => void;
    onStop: () => void;
    onReset: () => void;
    isRunning: boolean;
    isPaused: boolean;
}

export const BottomBar: React.FC<BottomBarProps> = ({ onStart, onPause, onStop, onReset, isRunning, isPaused }) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`fixed bottom-0 left-0 w-full z-40 transition-all duration-300 ${collapsed ? 'h-8' : 'h-20'} bg-white dark:bg-slate-950 border-t border-gray-300 dark:border-gray-700 flex items-center px-4`}
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
                <div className="flex gap-4 mx-auto">
                    <Button
                        onClick={onStart}
                        disabled={isRunning && !isPaused}
                        variant="default"
                        size="sm"
                    >
                        Start
                    </Button>
                    <Button
                        onClick={onPause}
                        disabled={!isRunning || isPaused}
                        variant="outline"
                        size="sm"
                    >
                        Pause
                    </Button>
                    <Button
                        onClick={onStop}
                        disabled={!isRunning}
                        variant="destructive"
                        size="sm"
                    >
                        Stop
                    </Button>
                    <Button
                        onClick={onReset}
                        disabled={isRunning}
                        variant="outline"
                        size="sm"
                        className="ml-4"
                    >
                        Reset
                    </Button>
                </div>
            )}
        </div>
    );
};
