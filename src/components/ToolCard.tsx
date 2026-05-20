import { FC } from 'react';
import { IconTool } from './icons';

export interface ToolCallInfo {
    name: string;
    status?: 'completed' | 'error' | 'running' | string;
    duration?: string;
    args?: Array<[string, unknown]>;
}

interface ToolCardProps {
    tool: ToolCallInfo;
}

export const ToolCard: FC<ToolCardProps> = ({ tool }) => {
    const statusDotColor =
        tool.status === 'error' ? 'var(--danger)' : tool.status === 'running' ? 'var(--warn)' : 'var(--ok)';

    return (
        <div className="tool-card">
            <div className="tool-head">
                <IconTool className="ic-sm" />
                <span className="tool-name">{tool.name}()</span>
                <span className="tool-status">
                    <span
                        className="dot-live"
                        style={{
                            background: statusDotColor,
                            boxShadow: `0 0 0 3px color-mix(in srgb, ${statusDotColor} 30%, transparent)`,
                        }}
                    />
                    {tool.status || ''}
                    {tool.duration ? ` · ${tool.duration}` : ''}
                </span>
            </div>
            {tool.args && tool.args.length > 0 && (
                <div className="tool-body">
                    {tool.args.map(([k, v]) => (
                        <div className="row" key={k}>
                            <span className="k">{k}</span>
                            <span className="v">{String(v)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
