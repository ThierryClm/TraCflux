import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyseDiagrammeDialog from './AnalyseDiagrammeDialog';
import type { Groupe } from '../types/projet';

const groupe = (id: number, green: number): Groupe => ({
    id, name: `G${id}`, type: 'V', signal: 'R11v', minGreen: 6, offset: id * 20,
    durations: { green, orange: 3, red: 0 }
});

describe('AnalyseDiagrammeDialog', () => {
    it('affiche les règles non respectées en premier, puis les suggestions', () => {
        render(<AnalyseDiagrammeDialog isOpen onClose={() => {}} planName="PF1" groups={[groupe(1, 4), groupe(2, 8)]}
            cycleLength={60} conflictMatrix={[['', ''], ['', '']]} />);
        expect(screen.getByText('Analyse du diagramme — PF1')).toBeInTheDocument();
        expect(screen.getByText(/Règles non respectées \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Suggestions \(1\)/)).toBeInTheDocument();
        expect(screen.getByTestId('constat-vert-mini')).toHaveTextContent('ISR, 6e partie, art. 110 C1');
        // Ordre : rouge, puis orange, puis bleu.
        const titres = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent ?? '');
        expect(titres[0]).toMatch(/Règles non respectées/);
        expect(titres[titres.length - 1]).toMatch(/Suggestions/);
    });

    it('signale les points d\'attention en orange et les groupes ignorés', () => {
        const vide: Groupe = { id: 3, name: 'G3', type: '' as Groupe['type'], minGreen: 0, offset: 0, durations: { green: 0, orange: 0, red: 0 } };
        render(<AnalyseDiagrammeDialog isOpen onClose={() => {}} planName="PF1" groups={[groupe(1, 20), groupe(2, 10), vide]}
            cycleLength={60} conflictMatrix={[['', ''], ['', ''], ['', '']]} />);
        expect(screen.getByText(/Recommandations et points d'attention \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Point d'attention · Matrice/)).toBeInTheDocument();
        expect(screen.getByText(/1 groupe sans type ou sans vert est ignoré/)).toBeInTheDocument();
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

    it('dit qu’il n’y a rien à contrôler quand aucun groupe n’est renseigné', () => {
        const vide: Groupe = { id: 1, name: 'G1', type: '' as Groupe['type'], minGreen: 0, offset: 0, durations: { green: 0, orange: 0, red: 0 } };
        render(<AnalyseDiagrammeDialog isOpen onClose={() => {}} planName="PF1" groups={[vide]}
            cycleLength={60} conflictMatrix={[['']]} />);
        expect(screen.getByText(/Aucun groupe renseigné/)).toBeInTheDocument();
        expect(screen.queryByText(/contrôles sont respectés/)).toBeNull();
    });
});
