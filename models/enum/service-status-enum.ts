import { EnumCollection } from "./enum-collection";

export enum ServiceStatusEnum {
    Operational = 'Operational',
    Degraded = 'Degraded',
    PartialOutage = 'Partial Outage',
    Outage = 'Outage',
    ScheduledMaintenance = 'Scheduled Maintenance',
    Unknown = 'Unknown',
}

export namespace ServiceStatusEnum {
    export function getCollection(): EnumCollection<string>[] {
        return Object.keys(ServiceStatusEnum).map((key) => new EnumCollection(key, ServiceStatusEnum[key]));
    }
}

