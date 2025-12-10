import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface OPCNode {
    shortnodeid: string;
    browse_name: string;
    node_id: string;
}

interface OPCAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
}

export function OPCAutocomplete({
    value,
    onChange,
    placeholder = 'e.g., ns=2;s=Variable1',
    id,
}: OPCAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<OPCNode[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchSuggestions = useCallback(async (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const backendPort = import.meta.env.VITE_BACKEND_PORT || 5000;
            const response = await fetch(
                `http://localhost:${backendPort}/opc/autocomplete?search=${encodeURIComponent(searchTerm)}`
            );
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.nodes || []);
                setIsOpen(true);
                setSelectedIndex(-1);
            } else {
                console.error('Autocomplete error:', response.status, response.statusText);
                setSuggestions([]);
            }
        } catch (error) {
            console.error('Failed to fetch autocomplete suggestions:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        fetchSuggestions(newValue);
    };

    const handleSelectSuggestion = (node: OPCNode) => {
        onChange(node.shortnodeid);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleSelectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full">
            <Input
                ref={inputRef}
                id={id}
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (value && suggestions.length > 0) {
                        setIsOpen(true);
                    }
                }}
                autoComplete="off"
            />
            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((node, index) => (
                        <div
                            key={`${node.node_id}-${index}`}
                            onClick={() => handleSelectSuggestion(node)}
                            className={cn(
                                'px-3 py-2 cursor-pointer text-sm',
                                index === selectedIndex
                                    ? 'bg-blue-500 text-white dark:bg-blue-600'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
                            )}
                        >
                            <div className="font-medium">{node.shortnodeid}</div>
                            {node.browse_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {node.browse_name}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            Loading...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
