import { FC, useState } from 'react';
import { Popover } from '@mui/material';
import { IconTool } from './icons';
import './Overlay.css';
import { toolService } from '../services/api';
import { Tool } from '../types/api';

interface ToolSelectorProps {
    disabled?: boolean;
    renderTrigger: (open: (e: React.MouseEvent<HTMLElement>) => void, isOpen: boolean) => React.ReactNode;
}

export const ToolSelector: FC<ToolSelectorProps> = ({ disabled = false, renderTrigger }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [tools, setTools] = useState<Record<string, Tool>>({});
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);

    const open = Boolean(anchorEl);

    const fetchTools = async () => {
        setLoading(true);
        try {
            const response = await toolService.getAllTools();
            setTools(response.tools);
        } catch (error) {
            console.error('Failed to fetch tools:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (disabled) return;
        setAnchorEl(event.currentTarget);
        fetchTools();
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleToggleTool = async (toolName: string, currentEnabled: boolean) => {
        setUpdating(toolName);
        try {
            await toolService.setToolEnabled(toolName, !currentEnabled);
            setTools((prev) => ({
                ...prev,
                [toolName]: {
                    ...prev[toolName],
                    enabled: !currentEnabled,
                },
            }));
        } catch (error) {
            console.error(`Failed to toggle tool ${toolName}:`, error);
        } finally {
            setUpdating(null);
        }
    };

    const handleEnableAll = async () => {
        setUpdating('all');
        try {
            await toolService.enableAllTools();
            await fetchTools();
        } catch (error) {
            console.error('Failed to enable all tools:', error);
        } finally {
            setUpdating(null);
        }
    };

    const handleDisableAll = async () => {
        setUpdating('all');
        try {
            await toolService.disableAllTools();
            await fetchTools();
        } catch (error) {
            console.error('Failed to disable all tools:', error);
        } finally {
            setUpdating(null);
        }
    };

    const enabledCount = Object.values(tools).filter((t) => t.enabled).length;
    const totalCount = Object.keys(tools).length;

    return (
        <>
            {renderTrigger(handleClick, open)}

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                // Paper는 껍데기로만 쓴다 — 배경/테두리/그림자는 .ov-pop이 그린다
                PaperProps={{ sx: { bgcolor: 'transparent', backgroundImage: 'none', boxShadow: 'none', borderRadius: 'var(--r-md)' } }}
            >
                <div className="ov-pop" style={{ width: 320, maxHeight: 420 }}>
                    <div className="ov-head">
                        <IconTool className="ic-sm" />
                        <div className="ov-head-text">
                            <span className="ov-title">도구 설정</span>
                        </div>
                        <span className="ov-head-spacer" />
                        {totalCount > 0 && (
                            <span className="ov-badge">{enabledCount}/{totalCount}</span>
                        )}
                    </div>

                    <div className="ov-body" style={{ gap: 10, paddingBottom: 10 }}>
                        <span className="mono-label">답변 생성에 사용할 도구</span>
                        <div className="ov-btn-row">
                            <button
                                type="button"
                                className="ov-btn accent grow"
                                onClick={handleEnableAll}
                                disabled={updating === 'all' || totalCount === 0}
                            >
                                전체 활성화
                            </button>
                            <button
                                type="button"
                                className="ov-btn danger grow"
                                onClick={handleDisableAll}
                                disabled={updating === 'all' || totalCount === 0}
                            >
                                전체 비활성화
                            </button>
                        </div>
                    </div>

                    <div className="ov-divider" />

                    <div className="ov-body tight">
                        {loading ? (
                            <div className="ov-spin-center"><div className="ov-spin lg" /></div>
                        ) : totalCount === 0 ? (
                            <div className="ov-empty">도구 목록을 불러올 수 없습니다</div>
                        ) : (
                            <div className="ov-list">
                                {Object.entries(tools).map(([toolName, tool]) => (
                                    <div
                                        key={toolName}
                                        className={'ov-item static' + (tool.enabled ? '' : ' dim')}
                                    >
                                        <span className="ov-item-name" title={toolName}>{toolName}</span>
                                        {updating === toolName ? (
                                            <div className="ov-spin" />
                                        ) : (
                                            <label className="ov-toggle" title={tool.enabled ? '비활성화' : '활성화'}>
                                                <input
                                                    type="checkbox"
                                                    checked={tool.enabled}
                                                    onChange={() => handleToggleTool(toolName, tool.enabled)}
                                                    disabled={updating === 'all'}
                                                    aria-label={toolName}
                                                />
                                                <span className="ov-toggle-track" />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Popover>
        </>
    );
};
