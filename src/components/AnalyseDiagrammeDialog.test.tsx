import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyseDiagrammeDialog from './AnalyseDiagrammeDialog';
import type { Groupe } from '../types/projet';

const groupe = (id: number, green: number): Groupe => ({ id, name: `G${id}`, type: 'V', minGreen: 6, offset: id * 20, durations: { green, orange: 3, red: 0 } });

describe('AnalyseDiagrammeDialog', () => {
    it('classe les constats par niveau et cite la source', () => {
        render(<AnalyseDiagrammeDialog isOpen onClose={() => {}} planName="PF1" groups={[groupe(1, 4), groupe(2, 8)]}
            cycleLength={60} conflictMatrix={[['', ''], ['', '']]} />);
        expect(screen.getByText('Analyse du diagramme — PF1')).toBeInTheDocument();
        expect(screen.getByText(/Règle non respectée \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Suggestion \(1\)/)).toBeInTheDocument();
        expect(screen.getByTestId('constat-vert-mini')).toHaveTextContent('ISR, 6e partie, art. 110 C1');
    });

    it('annonce un plan conforme', () => {
        render(<AnalyseDiagrammeDialog isOpen onClose={() => {}} planName="PF1" groups={[groupe(1, 20)]}
            cycleLength={60} conflictMatrix={[['']]} />);
        expect(screen.getByText(/contrôles sont respectés/)).toBeInTheDocument();
    });

    it('ne rend rien fermée', () => {
        const { container } = render(<AnalyseDiagrammeDialog isOpen={false} onClose={() => {}} planName="PF1" groups={[]}
            cycleLength={60} conflictMatrix={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
