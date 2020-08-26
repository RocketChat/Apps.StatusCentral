import { StepEnum } from './../enums/step';
import { Incident } from './incident';
import { IncidentUpdate } from './incident-update';

export interface IContainer {
    data: Partial<Incident>;
    update: Partial<IncidentUpdate>;
    step: StepEnum;
    userId: string;
    roomId: string;
}
