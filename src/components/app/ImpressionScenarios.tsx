import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import TimelineDiagram from '../TimelineDiagram';
import TrafficTable from '../TrafficTable';
import DiagnosticPanel from '../DiagnosticPanel';
import { actionsSimulables, calculerScenario, optionScenario } from '../../simulation';
import type { PlanImprime, ScenarioCalcule } from '../../simulation';
import { groupesInhibes } from '../../utils/trafficHelpers';
import { lignesDiagnostic, courantDimensionnant } from '../../utils/diagnosticCarrefour';
import { getCapacityColorClass } from '../../utils/capacityCalc';
import type { Matrice, ScenarioSimulation } from '../../types/projet';

/**
 * Les scénarios d'un plan de feu, au dossier imprimé : la page de
 * comparaison, puis chaque scénario — diagramme simulé, actions, conflits,
 * trafic, réserve, selon les options communes de la boîte d'impression.
 *
 * Chaque scénario est recalculé sur SON plan et d'après sa version
 * enregistrée. Les temps changent, les formules non : trafic et réserve sont
 * les composants de l'écran, nourris du diagramme simulé.
 */

interface TrafficData {
    trafficVol?: number | string;
}

/** Les mesures de page communes au dossier : une seconde vaut la même largeur partout. */
export interface MiseEnPageScenario {
    dossierSidebarReal: number;
    dossierUsableWidth: number;
    refCycle: number;
    microPrintStyle: CSSProperties | null;
    tooltipsDiagram?: boolean;
}

interface ScenariosDuPlanProps {
    nomPlan: string;
    plan: PlanImprime;
    scenarios: ScenarioSimulation[];
    sections: Record<string, boolean>;
    conflictMatrix: Matrice;
    /** Jeu de trafic du plan, le même que ses propres sections trafic et réserve. */
    dataset: string;
    trafficDatasets: Record<string, Record<number, TrafficData>>;
    trafficDatasetNames: string[];
    page: MiseEnPageScenario;
}

const signe = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;

/** Degré de saturation et réserve du courant dimensionnant, comme le panneau Réserve. */
const CellulesDimensionnant = ({ dim }: { dim: ReturnType<typeof courantDimensionnant> }) => {
    if (!dim) return (<><td>—</td><td>—</td><td>—</td></>);
    const reserve = 100 - dim.capU;
    return (
        <>
            <td>GF{dim.g.id}</td>
            <td className={getCapacityColorClass(dim.capU)}>{dim.x.toFixed(2)}</td>
            <td className={reserve >= 0 ? getCapacityColorClass(dim.capU) : 'capacity-black'}>
                {reserve >= 0 ? `${reserve} %` : `dépassement ${-reserve} %`}
            </td>
        </>
    );
};

const ScenariosDuPlanImprimes = ({
    nomPlan, plan, scenarios, sections, conflictMatrix, dataset, trafficDatasets, trafficDatasetNames, page
}: ScenariosDuPlanProps) => {
    if (scenarios.length === 0) return null;
    const getTrafficData = (id: number) => (trafficDatasets[dataset] || {})[id] || {};
    const calcules = scenarios.map(sc => calculerScenario(sc, plan, conflictMatrix));

    const dimDe = (c: ScenarioCalcule | null) => courantDimensionnant(lignesDiagnostic(c
        ? {
            groups: c.groupesSimules, cycleLength: c.cycleSimule, getTrafficData,
            actionData: plan.actionData, inhibitedGroups: groupesInhibes(plan.actionData, c.actions)
        }
        : { groups: plan.groups, cycleLength: plan.cycleLength, getTrafficData, actionData: plan.actionData }));

    return (
        <>
            {sections.simulationComparatif && (
                <div className="print-dossier-section print-dossier-comparatif">
                    <h3>Comparaison des scénarios — plan de feu {nomPlan} (cycle {plan.cycleLength}s)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Données de trafic : {dataset}</h3>
                    <table className="print-comparatif-scenarios">
                        <thead>
                            <tr>
                                <th className="col-scenario">Scénario</th>
                                <th>Actions</th>
                                <th>Cycle simulé</th>
                                <th>Conflits</th>
                                <th>Courant dimens.</th>
                                <th>Degré sat.</th>
                                <th>Réserve</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="ligne-reference">
                                <td className="col-scenario">Plan nominal (référence)</td>
                                <td>—</td>
                                <td>{plan.cycleLength}s</td>
                                <td>—</td>
                                <CellulesDimensionnant dim={dimDe(null)} />
                            </tr>
                            {calcules.map(c => (
                                <tr key={c.scenario.nom}>
                                    <td className="col-scenario">{c.scenario.nom}</td>
                                    <td>{c.actions.length}</td>
                                    <td>{c.cycleSimule}s{c.cycleSimule !== plan.cycleLength ? ` (${signe(c.cycleSimule - plan.cycleLength)})` : ''}</td>
                                    <td className={c.conflits.length > 0 ? 'comparatif-alerte' : ''}>{c.conflits.length}</td>
                                    <CellulesDimensionnant dim={dimDe(c)} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {calcules.map(c => (
                <ScenarioImprime
                    key={c.scenario.nom}
                    calcule={c}
                    nomPlan={nomPlan}
                    plan={plan}
                    sections={sections}
                    conflictMatrix={conflictMatrix}
                    dataset={dataset}
                    trafficDatasets={trafficDatasets}
                    trafficDatasetNames={trafficDatasetNames}
                    page={page}
                />
            ))}
        </>
    );
};

interface ScenarioImprimeProps extends Omit<ScenariosDuPlanProps, 'scenarios'> {
    calcule: ScenarioCalcule;
}

const ScenarioImprime = ({
    calcule, nomPlan, plan, sections, conflictMatrix, dataset, trafficDatasets, trafficDatasetNames, page
}: ScenarioImprimeProps) => {
    const { scenario, actions, simu, cycleSimule, conflits, groupesSimules } = calcule;
    const { groups, cycleLength, actionData } = plan;
    const titre = `« ${scenario.nom} » — plan de feu ${nomPlan}`;
    const getTrafficData = (id: number) => (trafficDatasets[dataset] || {})[id] || {};
    // Mêmes règles d'échelle que les diagrammes des plans : une seconde vaut
    // la même largeur d'une page à l'autre, le cycle simulé se compare donc à
    // l'œil au cycle du plan.
    const diagramPageHeight = 648;
    const diagramRenderedHeight = 50 + 1 + groups.length * 31 + 90;
    const combinedScale = Math.min(1, diagramPageHeight / diagramRenderedHeight);
    const timelineDispo = page.dossierUsableWidth - page.dossierSidebarReal * combinedScale;
    const ppsVisuel = cycleSimule <= page.refCycle ? timelineDispo / page.refCycle : timelineDispo / cycleSimule;
    const simPPS = ppsVisuel / combinedScale;
    const actionsRetenues = actionsSimulables(actionData);

    return (
        <Fragment>
            {optionScenario(sections, 'simulationDiagramme') && (
                <div className="print-dossier-section print-dossier-diagram">
                    <h3>Scénario {titre} — Cycle simulé : {cycleSimule}s{cycleSimule !== cycleLength ? ` (${signe(cycleSimule - cycleLength)}s)` : ''}</h3>
                    <div style={{
                        height: `${Math.ceil(diagramRenderedHeight * combinedScale)}px`,
                        overflow: 'hidden',
                        background: '#fff'
                    }}>
                        <div className="print-diagram-content dossier-diagram-content" style={{
                            width: `${Math.ceil(page.dossierSidebarReal + cycleSimule * simPPS)}px`,
                            transform: combinedScale !== 1 ? `scale(${combinedScale.toFixed(3)})` : 'none',
                            transformOrigin: 'top left'
                        }}>
                            <TimelineDiagram
                                groups={groups}
                                globalTime={0}
                                onGroupClick={() => {}}
                                pixelsPerSecond={simPPS}
                                conflicts={[]}
                                conflictMatrix={conflictMatrix}
                                updateGroupParams={() => {}}
                                cycleLength={cycleLength}
                                actionData={actionData}
                                updateActionRow={() => {}}
                                startDrag={() => {}}
                                endDrag={() => {}}
                                showDependencies={false}
                                dependencyGap={20}
                                hoveredActionId={null}
                                setHoveredActionId={() => {}}
                                simulationFilter={new Set(actions)}
                                simulationResult={simu}
                                planName={nomPlan}
                                showComments={false}
                                showRemarks={false}
                                tooltipsEnabled={page.tooltipsDiagram}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Liste des actions, avec la coche de chacune : c'est le choix
                du scénario qui explique le diagramme simulé. */}
            {optionScenario(sections, 'simulationActions') && actionsRetenues.length > 0 && (
                <div className="print-dossier-section print-dossier-actions">
                    <h3>Actions retenues : {titre}</h3>
                    <table className="print-simulation-actions">
                        <thead>
                            <tr>
                                <th className="col-coche">Simulée</th>
                                <th className="col-gf">GF</th>
                                <th className="col-action">Action</th>
                                <th className="col-temps">Temps</th>
                                <th className="col-micro">Action_Micro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actionsRetenues.map(action => {
                                const cochee = actions.includes(action.id);
                                const temps = action.deb === '' ? ''
                                    : (action.fin === '' ? `${action.deb}s` : `${action.deb}-${action.fin}s`);
                                return (
                                    <tr key={action.id} className={cochee ? 'action-cochee' : 'action-decochee'}>
                                        <td className="col-coche">{cochee ? '☒' : '☐'}</td>
                                        <td className="col-gf">{action.gf ? `GF${action.gf}` : ''}</td>
                                        <td className="col-action">{action.action}</td>
                                        <td className="col-temps">{temps}</td>
                                        {/* Même rendu que le tableau des conditions du plan :
                                            largeur et police relevées à l'écran, le navigateur
                                            replie donc aux mêmes endroits. */}
                                        <td className="col-micro print-micro-cell">
                                            <div className="print-micro-wrap" style={page.microPrintStyle || undefined}>{action.micro}</div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Conflits du diagramme simulé — les mêmes que le panneau à
                l'écran, escamotages cochés déduits. */}
            {optionScenario(sections, 'simulationConflits') && (
                <div className="print-dossier-section print-dossier-conflits">
                    <h3>Conflits : {titre} : {conflits.length}</h3>
                    {conflits.length === 0 ? (
                        <p className="print-conflits-aucun">Aucun conflit sur le diagramme simulé.</p>
                    ) : (
                        <table className="print-simulation-conflits">
                            <thead>
                                <tr>
                                    <th className="col-gf">Groupes</th>
                                    <th className="col-motif">Conflit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conflits.map((c, i) => (
                                    <tr key={i}>
                                        <td className="col-gf">GF{c.from} - GF{c.to}</td>
                                        <td className="col-motif">{c.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {optionScenario(sections, 'simulationTrafic') && (
                <div className="print-dossier-section print-dossier-traffic">
                    <h3>Données de trafic et calcul de capacité : {titre}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Données de trafic : {dataset}</h3>
                    <TrafficTable
                        groups={groups}
                        cycleLength={cycleLength}
                        activeTrafficDataset={dataset}
                        setActiveTrafficDataset={() => {}}
                        updateTrafficData={() => {}}
                        getTrafficData={getTrafficData}
                        updateGroupParams={() => {}}
                        trafficDatasetNames={trafficDatasetNames}
                        copyTrafficDataset={() => {}}
                        addCustomTrafficDataset={() => {}}
                        actionData={actionData}
                        simulationSelectedActions={actions}
                        simulationResult={simu}
                        readOnly
                        tooltipsEnabled={false}
                    />
                </div>
            )}

            {optionScenario(sections, 'simulationReserve') && (
                <div className="print-dossier-section print-dossier-reserve">
                    <h3>Réserve de capacité : {titre}</h3>
                    <DiagnosticPanel
                        groups={groupesSimules}
                        cycleLength={cycleSimule}
                        getTrafficData={getTrafficData}
                        actionData={actionData}
                        activeTrafficDataset={dataset}
                        inhibitedGroups={groupesInhibes(actionData, actions)}
                        hideTitle={true}
                    />
                </div>
            )}
        </Fragment>
    );
};

export default ScenariosDuPlanImprimes;
