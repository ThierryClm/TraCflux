import type { BandwidthData } from '../../utils/greenWaveBandwidth';

interface GreenWaveLegendProps {
    speedUp: number;
    speedDown: number;
    bandwidthData: BandwidthData | null;
}

/** Légende du diagramme : groupes, vitesses, bandes passantes et actions signalées. */
const GreenWaveLegend = ({ speedUp, speedDown, bandwidthData }: GreenWaveLegendProps) => (
    <div className="green-wave-legend">
        <div className="legend-item">
            <div className="legend-color" style={{ background: '#FF9800' }}></div>
            <span>Groupe 1 (descendant)</span>
        </div>
        <div className="legend-item">
            <div className="legend-color" style={{ background: '#8BC34A' }}></div>
            <span>Groupe 2 (montant)</span>
        </div>
        <div className="legend-item">
            <div className="legend-line" style={{ borderColor: '#4CAF50' }}></div>
            <span>V. montante: {speedUp} km/h</span>
        </div>
        <div className="legend-item">
            <div className="legend-line" style={{ borderColor: '#FF9800' }}></div>
            <span>V. descendante: {speedDown} km/h</span>
        </div>
        {bandwidthData?.ascending && (
            <div className="legend-item">
                <div className="legend-bandwidth" style={{ background: 'rgba(76, 175, 80, 0.3)', borderColor: '#4CAF50' }}></div>
                <span>Montant: {bandwidthData.ascending.width.toFixed(1)}s</span>
            </div>
        )}
        {bandwidthData?.descending && (
            <div className="legend-item">
                <div className="legend-bandwidth" style={{ background: 'rgba(255, 152, 0, 0.3)', borderColor: '#FF9800' }}></div>
                <span>Descendant: {bandwidthData.descending.width.toFixed(1)}s</span>
            </div>
        )}
        <div className="legend-item">
            <div className="legend-color" style={{ background: '#2E7D32', border: '1px solid #4CAF50' }}></div>
            <span>Seconde lucarne</span>
        </div>
        <div className="legend-item">
            <div className="legend-color" style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #4CAF50 2px, #4CAF50 4px)',
                border: '1px solid #4CAF50'
            }}></div>
            <span>Ouverture anticipée</span>
        </div>
    </div>
);

export default GreenWaveLegend;
