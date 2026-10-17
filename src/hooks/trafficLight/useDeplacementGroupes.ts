/**
 * Déplacement d'un groupe de feu : les données des groupes changent de
 * place, leurs numéros (GF) restent. Matrices, diagrammes de tous les plans,
 * jeux de trafic et références GF des conditions suivent. Sous-hook de
 * useTrafficLight.
 */
import type { Dispatch, SetStateAction } from 'react';
import { entier } from '../../utils/entier';
import type { ActionMicro, Groupe, JeuTrafic, Matrice, PlanDeFeu } from '../../types/projet';
import type { JeuxTrafic } from './types';

/** Champs d'une condition qui désignent un groupe de feu par son numéro. */
export const CHAMPS_GF: ('gf' | 'plage1' | 'plage2' | 'actGf1' | 'actGf1Gf2' | 'actGf1Gf3' | 'actGf1Gf4')[] = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];

interface EntreesDeplacementGroupes {
    groups: Groupe[];
    activePFId: number;
    setGroups: Dispatch<SetStateAction<Groupe[]>>;
    setConflictMatrix: Dispatch<SetStateAction<Matrice>>;
    setActionData: (newData: SetStateAction<ActionMicro[]>) => void;
    setPfTabs: Dispatch<SetStateAction<PlanDeFeu[]>>;
    setTrafficDatasets: Dispatch<SetStateAction<JeuxTrafic>>;
}

export const useDeplacementGroupes = ({
    groups, activePFId, setGroups, setConflictMatrix, setActionData, setPfTabs, setTrafficDatasets
}: EntreesDeplacementGroupes) => {
    // Swap group data and matrix, but keep GF IDs in place (G1 stays G1, G2 stays G2)
    const moveGroup = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === groups.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // GF numbers are 1-based (index + 1)
        const gfA = index + 1;
        const gfB = targetIndex + 1;

        // 1. Swap group DATA (but keep IDs in place)
        setGroups(currentGroups => {
            const newGroups = [...currentGroups];
            const groupA = newGroups[index];
            const groupB = newGroups[targetIndex];

            // Swap all properties except ID
            newGroups[index] = {
                ...groupB,
                id: groupA.id  // Keep original ID
            };
            newGroups[targetIndex] = {
                ...groupA,
                id: groupB.id  // Keep original ID
            };

            return newGroups;
        });

        // 2. Swap matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            const newMatrix = currentMatrix.map(row => [...row]);

            // Swap Rows
            const tempRow = newMatrix[index];
            newMatrix[index] = newMatrix[targetIndex];
            newMatrix[targetIndex] = tempRow;

            // Swap Cols
            for (let r = 0; r < newMatrix.length; r++) {
                const row = newMatrix[r];
                const tempVal = row[index];
                row[index] = row[targetIndex];
                row[targetIndex] = tempVal;
            }
            return newMatrix;
        });

        // 3. Swap GF references in ActionTable
        // Permute les références aux deux groupes dans une condition.
        const permuterGf = (row: ActionMicro): ActionMicro => {
            const newRow = { ...row };
            CHAMPS_GF.forEach(field => {
                const val = entier(newRow[field]);
                if (val === gfA) {
                    newRow[field] = gfB.toString();
                } else if (val === gfB) {
                    newRow[field] = gfA.toString();
                }
            });
            return newRow;
        };

        setActionData(currentData => currentData.map(permuterGf));

        // 4. Swap diagram data in ALL PF tabs (not just the active one)
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Swap diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    const newDiagram = [...newPf.diagram];
                    const entryA = newDiagram.find(d => d.groupId === gfA);
                    const entryB = newDiagram.find(d => d.groupId === gfB);

                    if (entryA && entryB) {
                        // Swap all properties except groupId
                        const tempOffset = entryA.offset;
                        const tempGreenDuration = entryA.greenDuration;
                        const tempDa = entryA.da;
                        const tempComment = entryA.comment;
                        const tempCommentColor = entryA.commentColor;

                        entryA.offset = entryB.offset;
                        entryA.greenDuration = entryB.greenDuration;
                        entryA.da = entryB.da;
                        entryA.comment = entryB.comment;
                        entryA.commentColor = entryB.commentColor;

                        entryB.offset = tempOffset;
                        entryB.greenDuration = tempGreenDuration;
                        entryB.da = tempDa;
                        entryB.comment = tempComment;
                        entryB.commentColor = tempCommentColor;
                    }
                    newPf.diagram = newDiagram;
                }

                // Swap conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const newMatrix = newPf.conflictMatrix.map(row => [...row]);

                    // Swap Rows
                    const tempRow = newMatrix[index];
                    newMatrix[index] = newMatrix[targetIndex];
                    newMatrix[targetIndex] = tempRow;

                    // Swap Cols
                    for (let r = 0; r < newMatrix.length; r++) {
                        const row = newMatrix[r];
                        const tempVal = row[index];
                        row[index] = row[targetIndex];
                        row[targetIndex] = tempVal;
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Swap GF references in action data if it exists
                if (newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(permuterGf);
                }

                return newPf;
            });
        });
    };

    // Move a group to a new position (after another group)
    // sourceId: the ID of the group to move
    // afterId: the ID of the group after which to insert (0 = insert at beginning)
    const moveGroupToPosition = (sourceId: number, afterId: number) => {
        const sourceIndex = groups.findIndex(g => g.id === sourceId);
        if (sourceIndex === -1) return;

        // Calculate target index
        let targetIndex;
        if (afterId === 0) {
            targetIndex = 0; // Insert at beginning
        } else {
            const afterIndex = groups.findIndex(g => g.id === afterId);
            if (afterIndex === -1) return;
            targetIndex = afterIndex + 1;
        }

        // Adjust target if source is before target
        if (sourceIndex < targetIndex) {
            targetIndex--;
        }

        if (sourceIndex === targetIndex) return; // No change needed

        // Create mapping from old positions to new positions
        const oldToNew: Record<number, number> = {};
        const newToOld: Record<number, number> = {};

        // Build the new order of groups
        const newGroups = [...groups];
        const [movedGroup] = newGroups.splice(sourceIndex, 1);
        newGroups.splice(targetIndex, 0, movedGroup);

        // Create position mappings (1-based GF numbers)
        for (let i = 0; i < groups.length; i++) {
            const oldGf = i + 1;
            const group = groups[i];
            const newIndex = newGroups.findIndex(g => g.id === group.id);
            const newGf = newIndex + 1;
            oldToNew[oldGf] = newGf;
            newToOld[newGf] = oldGf;
        }

        // 1. Reorder groups and reassign IDs to be sequential
        setGroups(() => {
            return newGroups.map((g, idx) => ({
                ...g,
                id: idx + 1
            }));
        });

        // 2. Reorder matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            const size = currentMatrix.length;
            const newMatrix: Matrice = Array(size).fill(null).map(() => Array(size).fill(0));

            // Copy values to new positions
            for (let oldRow = 0; oldRow < size; oldRow++) {
                for (let oldCol = 0; oldCol < size; oldCol++) {
                    const newRow = oldToNew[oldRow + 1] - 1;
                    const newCol = oldToNew[oldCol + 1] - 1;
                    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                        newMatrix[newRow][newCol] = currentMatrix[oldRow][oldCol];
                    }
                }
            }

            return newMatrix;
        });

        // 3. Update GF references in ActionTable
        const size = groups.length;

        // Renumérote les références aux groupes dans une condition.
        const renumeroterGf = (row: ActionMicro): ActionMicro => {
            const newRow = { ...row };
            CHAMPS_GF.forEach(field => {
                const val = entier(newRow[field]);
                if (!isNaN(val) && val > 0 && val <= size) {
                    newRow[field] = oldToNew[val].toString();
                }
            });
            return newRow;
        };

        // Remap active PF tab data first
        setActionData(currentData => currentData.map(renumeroterGf));

        // 4. Update ALL PF tabs with reordered data
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Reorder diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    newPf.diagram = newPf.diagram.map(entry => ({
                        ...entry,
                        groupId: oldToNew[entry.groupId] || entry.groupId
                    }));
                }

                // Reorder conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const pfSize = newPf.conflictMatrix.length;
                    const newMatrix: Matrice = Array(pfSize).fill(null).map(() => Array(pfSize).fill(''));
                    const source = newPf.conflictMatrix;

                    for (let oldRow = 0; oldRow < pfSize; oldRow++) {
                        for (let oldCol = 0; oldCol < pfSize; oldCol++) {
                            const newRow = oldToNew[oldRow + 1] - 1;
                            const newCol = oldToNew[oldCol + 1] - 1;
                            if (newRow >= 0 && newRow < pfSize && newCol >= 0 && newCol < pfSize) {
                                newMatrix[newRow][newCol] = source[oldRow][oldCol];
                            }
                        }
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Update GF references in action data for non-active tabs
                // (active tab already handled by setActionData above)
                if (pf.id !== activePFId && newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(renumeroterGf);
                }

                return newPf;
            });
        });

        // 5. Reorder traffic datasets (keyed by groupId)
        setTrafficDatasets(currentDatasets => {
            const newDatasets: JeuxTrafic = {};
            Object.keys(currentDatasets).forEach(datasetKey => {
                const dataset = currentDatasets[datasetKey];
                const newDataset: JeuTrafic = {};
                Object.keys(dataset).forEach(oldGroupId => {
                    const oldId = entier(oldGroupId);
                    const newId = oldToNew[oldId];
                    if (newId) {
                        newDataset[newId] = dataset[oldGroupId];
                    }
                });
                newDatasets[datasetKey] = newDataset;
            });
            return newDatasets;
        });
    };

    return { moveGroup, moveGroupToPosition };
};
