import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrafficLight from './TrafficLight';

describe('TrafficLight', () => {
    it.each(['red', 'orange', 'green'] as const)(
        'active uniquement le feu %s',
        (currentPhase) => {
            const { container } = render(<TrafficLight currentPhase={currentPhase} />);

            expect(container.querySelectorAll('.light.active')).toHaveLength(1);
            expect(container.querySelector(`.light.${currentPhase}`)).toHaveClass('active');
        },
    );
});
