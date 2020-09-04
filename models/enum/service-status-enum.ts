import { EnumCollection } from "./enum-collection";

export enum ServiceStatusEnum {
    Nominal = 'Nominal',
    Degraded = 'Degraded',
    PartialOutage = 'Partial-outage',
    Outage = 'Outage',
    ScheduledMaintenance = 'Scheduled Maintenance',
    Unknown = 'Unknown',
}

export namespace ServiceStatusEnum {
    export function getCollection(): EnumCollection<string>[] {
        return Object.keys(ServiceStatusEnum).map((key) => new EnumCollection(key, ServiceStatusEnum[key]));
    }
}
