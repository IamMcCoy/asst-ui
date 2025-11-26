import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
    ChartData
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box
} from '@mui/material';

// Chart.js 등록
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

// 타입 정의

export interface VisualizationInfo {
    viz_type: ChartType;
    chart_config?: ChartConfig;
    query_result: DataItem[];
}

export type ChartType = 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'none';

export interface ChartConfig {
    x_axis: string;
    y_axis: string;
    x_label?: string;
    y_label?: string;
}

export interface DataItem {
    [key: string]: string | number;
}

const ChartVisualization: React.FC<VisualizationInfo> = ({ viz_type, chart_config, query_result }) => {
    // 데이터가 없으면 렌더링 안함
    if (!query_result || query_result.length === 0) {
        return null;
    }

    // Table인 경우 config 없어도 OK
    if (viz_type !== 'table' && !chart_config) {
        return null;
    }

    // Table 렌더링 함수
    const renderTable = () => {
        const headers = Object.keys(query_result[0]);

        return (
            <TableContainer
                component={Paper}
                sx={{
                    backgroundColor: '#1e293b',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
            >
                <Table sx={{ minWidth: 650 }}>
                    <TableHead>
                        <TableRow>
                            {headers.map((key) => (
                                <TableCell
                                    key={key}
                                    sx={{
                                        color: '#ffffff',
                                        fontWeight: 'bold',
                                        backgroundColor: '#0f172a',
                                        borderBottom: '2px solid #334155'
                                    }}
                                >
                                    {key}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {query_result.map((row, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    '&:hover': {
                                        backgroundColor: '#334155'
                                    },
                                    '&:last-child td': {
                                        borderBottom: 0
                                    }
                                }}
                            >
                                {Object.values(row).map((value, cellIndex) => (
                                    <TableCell
                                        key={cellIndex}
                                        sx={{
                                            color: '#e2e8f0',
                                            borderBottom: '1px solid #334155'
                                        }}
                                    >
                                        {value}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    // Chart 렌더링 함수
    const renderChart = () => {
        if (!chart_config) return null;

        const { x_axis, y_axis, x_label, y_label } = chart_config;

        const labels = query_result.map(item => String(item[x_axis]));
        const dataValues = query_result.map(item => Number(item[y_axis]));

        switch (viz_type) {
            case 'bar_chart': {
                const barData = {
                    labels,
                    datasets: [{
                        label: y_axis,
                        data: dataValues,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    }]
                } as ChartData<'bar'>;
                const barOptions: ChartOptions<'bar'> = {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false,
                        },
                        title: {
                            display: false,
                        },
                    },
                    scales: {
                        x: {
                            title: {
                                display: !!x_label,
                                text: x_label || x_axis,
                                color: '#ffffff',
                                font: { size: 14 }
                            },
                            ticks: { color: '#ffffff' },
                            grid: { color: '#334155' }
                        },
                        y: {
                            title: {
                                display: !!y_label,
                                text: y_label || y_axis,
                                color: '#ffffff',
                                font: { size: 14 }
                            },
                            beginAtZero: true,
                            ticks: { color: '#ffffff' },
                            grid: { color: '#334155' }
                        }
                    }
                };
                return <Bar data={barData} options={barOptions} />;
            }
            case 'line_chart': {
                const lineData = {
                    labels,
                    datasets: [{
                        label: y_axis,
                        data: dataValues,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                    }]
                } as ChartData<'line'>;
                const lineOptions: ChartOptions<'line'> = {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false,
                        },
                        title: {
                            display: false,
                        },
                    },
                    scales: {
                        x: {
                            title: {
                                display: !!x_label,
                                text: x_label || x_axis,
                                color: '#ffffff',
                                font: { size: 14 }
                            },
                            ticks: { color: '#ffffff' },
                            grid: { color: '#334155' }
                        },
                        y: {
                            title: {
                                display: !!y_label,
                                text: y_label || y_axis,
                                color: '#ffffff',
                                font: { size: 14 }
                            },
                            beginAtZero: true,
                            ticks: { color: '#ffffff' },
                            grid: { color: '#334155' }
                        }
                    }
                };
                return <Line data={lineData} options={lineOptions} />;
            }
            case 'pie_chart': {
                const pieData = {
                    labels,
                    datasets: [{
                        label: y_axis,
                        data: dataValues,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                            'rgba(255, 159, 64, 0.6)',
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(255, 159, 64, 1)',
                        ],
                        borderWidth: 1,
                    }]
                } as ChartData<'pie'>;
                const pieOptions: ChartOptions<'pie'> = {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                color: '#ffffff'
                            }
                        },
                        title: {
                            display: false,
                        },
                    },
                };
                return <Pie data={pieData} options={pieOptions} />;
            }
            default:
                return null;
        }
    };

    // 타입별 렌더링
    const renderVisualization = () => {
        switch (viz_type) {
            case 'table':
                return renderTable();
            case 'bar_chart':
            case 'line_chart':
            case 'pie_chart':
                return renderChart();
            default:
                return null;
        }
    };

    return (
        <Box
            sx={{
                width: '100%',
                padding: 2
            }}
        >
            {renderVisualization()}
        </Box>
    );
};

export default ChartVisualization;
