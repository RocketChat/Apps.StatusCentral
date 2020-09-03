import { IModify, ILogger, IRead, IHttp } from '@rocket.chat/apps-engine/definition/accessors';
import { IOptionObject } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { IncidentService } from '../../service/incident-service';
import { Incident } from '../../models/incident';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { EnumCollection } from '../../models/enum/enum-collection';
import { ServiceStatusEnum } from '../../models/enum/service-status-enum';
import { Service } from '../../models/service';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IncidentStatusEnum } from '../../models/enum/incident-status-enum';
import { IncidentMaintenance } from '../../models/incident-maintenance';

class IncidentCreateViewState {
    public appName: string;
    public room: IRoom;
    public roomUsers: IUser[];
    public roomUsersSelected: any[];
    public user: IUser;
    public incidentStatuses: EnumCollection<string>[];
    public incidentStatusSelected: any;
    public services: any[];
    public servicesSelected: any[];
    public serviceStatuses: EnumCollection<string>[]

    public static create(): IncidentCreateViewState {
        return new IncidentCreateViewState();
    }

    public withAppName(value: string): IncidentCreateViewState {
        this.appName = value;
        return this;
    }

    public withRoom(value: IRoom): IncidentCreateViewState {
        this.room = value;
        return this;
    }

    public withRoomUsers(value: IUser[]): IncidentCreateViewState {
        this.roomUsers = value;
        return this;
    }

    public withRoomUsersSelected(value: any[]): IncidentCreateViewState {
        this.roomUsersSelected = value;
        return this;
    }

    public withUser(value: IUser): IncidentCreateViewState {
        this.user = value;
        return this;
    }

    public withIncidentStatuses(value: EnumCollection<string>[]): IncidentCreateViewState {
        this.incidentStatuses = value;
        return this;
    }

    public withIncidentStatusSelected(value: any): IncidentCreateViewState {
        this.incidentStatusSelected = value;
        return this;
    }

    public withServices(value: Service[]): IncidentCreateViewState {
        this.services = value;
        return this;
    }

    public withServicesSelected(value: any[]): IncidentCreateViewState {
        this.servicesSelected = value;
        return this;
    }

    public withServiceStatuses(value: EnumCollection<string>[]): IncidentCreateViewState {
        this.serviceStatuses = value;
        return this;
    }
}

export class IncidentCreateView {
    private state: IncidentCreateViewState;
    private logger: ILogger;
    private service: IncidentService;

    constructor(logger: ILogger, service: IncidentService) {
        this.logger = logger;
        this.service = service;
    }

    public async renderAsync(modify: IModify): Promise<IUIKitModalViewParam>  {
        let block = modify.getCreator().getBlockBuilder()
        block
            .addInputBlock({
                blockId: 'vinc_title_input',
                element: block.newPlainTextInputElement({actionId: 'vinc_title_input_value'}),
                label: block.newPlainTextObject('Inform the incident description')
            })
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the incident status')
            })
            .addActionsBlock({
                blockId: 'vinc_status_static',
                elements: [
                    block.newStaticSelectElement({
                        placeholder: block.newPlainTextObject('Select the incident status'),
                        actionId: 'vinc_status_static_select',
                        options: this.state.incidentStatuses.map((status) => 
                            <IOptionObject> { text: block.newPlainTextObject(status.value), value: status.value }),
                        initialValue: this.state.incidentStatusSelected
                    }),
                ]
            })
    
        if (this.state.incidentStatusSelected) {
            if (this.state.incidentStatusSelected == IncidentStatusEnum.ScheduledMaintenance) {
                block
                    .addDividerBlock()
                    .addInputBlock({
                        blockId: 'vinc_schedule_start_input',
                        element: block.newPlainTextInputElement({
                            initialValue: String(Math.round(new Date().getTime()/1000)), 
                            actionId: 'vinc_schedule_start_input_value'
                        }),
                        label: block.newPlainTextObject('Inform the maintenance start time (Unix timestamp)')
                    })
                    .addInputBlock({
                        blockId: 'vinc_schedule_end_input',
                        element: block.newPlainTextInputElement({
                            initialValue: String(Math.round(new Date().getTime()/1000)), 
                            actionId: 'vinc_schedule_end_input_value'
                        }),
                        label: block.newPlainTextObject('Inform the maintenance predicted end time (Unix timestamp)')
                    })
            }
        }

        block
            .addDividerBlock()
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the users that may support you with the resolution')
            })
            .addActionsBlock({
                blockId: 'vinc_users_multi',
                elements: [
                    block.newMultiStaticElement({
                        placeholder: block.newPlainTextObject('Select the users'),
                        actionId: 'vinc_users_multi_select',
                        options: this.state.roomUsers.map((user) => 
                            <IOptionObject> { text: block.newPlainTextObject(user.name), value: user.username }),
                        initialValue: this.state.roomUsersSelected,
                    }),
                ]
            })
            .addDividerBlock()
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the affected services')
            })
            .addActionsBlock({
                blockId: 'vinc_services_multi',
                elements: [
                    block.newMultiStaticElement({
                        placeholder: block.newPlainTextObject('Select the affected services'),
                        actionId: 'vinc_services_multi_select',
                        options: this.state.services.map((service) => 
                            <IOptionObject> { text: block.newPlainTextObject(service.name), value: service.id }),
                        initialValue: this.state.servicesSelected,
                    }),
                ]
            })
            .addDividerBlock()

        if (this.state.servicesSelected && this.state.incidentStatusSelected) {
            if (this.state.incidentStatusSelected != IncidentStatusEnum.ScheduledMaintenance) {
                this.state.servicesSelected.forEach((id) => {
                    const serviceName = this.state.services.find((item) => item.id == id).name;
                    block
                        .addSectionBlock({
                            text: block.newPlainTextObject(`Inform the ${serviceName} status`)
                        })
                        .addActionsBlock({
                            blockId: `vinc_services_${id}_status_static`,
                            elements: [
                                block.newStaticSelectElement({
                                    placeholder: block.newPlainTextObject(`Select the status`),
                                    actionId: `vinc_services_${id}_status_static_select`,
                                    options: this.state.serviceStatuses.map((item) => 
                                        <IOptionObject> { text: block.newPlainTextObject(item.value), value: item.id })
                                })
                            ]
                        })
                })
            }
        }
        
        return {
            id: 'incident_create_view',
            title: block.newPlainTextObject('Create an incident'),
            submit: block.newButtonElement({
                actionId: "vinc_create",
                text: block.newPlainTextObject('Create'),
            }),
            close: block.newButtonElement({
                actionId: "vinc_dismiss",
                text: block.newPlainTextObject('Dismiss')
            }),
            blocks: block.getBlocks()
        }
    }

    public setInitialState(appName: string,
        incidentStatuses: EnumCollection<string>[], 
        services: Service[], 
        serviceStatuses: EnumCollection<string>[],
        room: IRoom,
        roomUsers: IUser[],
        user: IUser): void {
        this.state = IncidentCreateViewState.create()
            .withAppName(appName)
            .withRoom(room)
            .withRoomUsers(roomUsers)
            .withUser(user)
            .withIncidentStatuses(incidentStatuses)
            .withServices(services)
            .withServiceStatuses(serviceStatuses);
    }

    public setState(incidentStatusSelected?: any, servicesSelected?: any[], roomUsersSelected?: any[]): void {
        if (incidentStatusSelected) {
            this.state = IncidentCreateViewState.create()
                .withAppName(this.state.appName)
                .withRoom(this.state.room)
                .withRoomUsers(this.state.roomUsers)
                .withRoomUsersSelected(this.state.roomUsersSelected)
                .withUser(this.state.user)
                .withIncidentStatuses(this.state.incidentStatuses)
                .withIncidentStatusSelected(incidentStatusSelected)
                .withServices(this.state.services)
                .withServicesSelected(this.state.servicesSelected)
                .withServiceStatuses(this.state.serviceStatuses);
        }
        if (servicesSelected) {
            this.state = IncidentCreateViewState.create()
                .withAppName(this.state.appName)
                .withRoom(this.state.room)
                .withRoomUsers(this.state.roomUsers)
                .withRoomUsersSelected(this.state.roomUsersSelected)
                .withUser(this.state.user)
                .withIncidentStatuses(this.state.incidentStatuses)
                .withIncidentStatusSelected(this.state.incidentStatusSelected)
                .withServices(this.state.services)
                .withServicesSelected(servicesSelected)
                .withServiceStatuses(this.state.serviceStatuses);
        } 
        if (roomUsersSelected) {
            this.state = IncidentCreateViewState.create()
                .withAppName(this.state.appName)
                .withRoom(this.state.room)
                .withRoomUsers(this.state.roomUsers)
                .withRoomUsersSelected(roomUsersSelected)
                .withUser(this.state.user)
                .withIncidentStatuses(this.state.incidentStatuses)
                .withIncidentStatusSelected(this.state.incidentStatusSelected)
                .withServices(this.state.services)
                .withServicesSelected(this.state.servicesSelected)
                .withServiceStatuses(this.state.serviceStatuses);
        }
    }

    private generateDiscussionId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    public onDismiss() : void {}

    public async onSubmitAsync(data: any, modify: IModify, read: IRead, http: IHttp) : Promise<Incident> {
        let incident = Incident.create()
            .withTime(new Date())
            .withTitle(data['vinc_title_input']['vinc_title_input_value'])
            .withStatus(data['vinc_status_static']['vinc_status_static_select']);

        if (incident.status == IncidentStatusEnum.ScheduledMaintenance) {
            incident = incident.withMaintenance(IncidentMaintenance.create()
                .withStart(new Date(data['vinc_schedule_start_input']['vinc_schedule_start_input_value'] * 1000))
                .withEnd(new Date(data['vinc_schedule_end_input']['vinc_schedule_end_input_value'] * 1000)))
                .withServices(data['vinc_services_multi']['vinc_services_multi_select'].map((index) => this.state.services[index - 1]));
        } else {
            incident = incident.withServices(data['vinc_services_multi']['vinc_services_multi_select'].map((index) => { 
                let service = this.state.services[index - 1];
                service.status = ServiceStatusEnum[data[`vinc_services_${index}_status_static`][`vinc_services_${index}_status_static_select`]];
                return service;
            }));
        }
        try {
            incident = await this.service.create(incident, read, http);
        
            const messageText = `We have a new incident with ID *${incident.id}*: *${incident.status.toLocaleUpperCase()}*
            
                *Created at*: ${new Date(incident.time).toUTCString()}
                *Owner*: @${this.state.user.username}
                *Support requested from*: ${this.state.roomUsersSelected.map(user => `@${user}`).join(', ')}
                *Description*: _*${incident.title}*_
                *Services affected**: 
                ${incident.services.map(service => `- *${service.name}*: _${service.status}_ \n`).join(' ')}
            `
            let message = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setSender(await read.getUserReader().getByUsername('rocket.cat'))
                .setUsernameAlias(this.state.appName)
                .setGroupable(false)
                .setText(messageText);
            await modify.getCreator().finish(message);

            const discussionId = this.generateDiscussionId();
            const discussion = await modify.getCreator().startDiscussion()
                .setParentRoom(this.state.room)
                .setDisplayName(`Incident - ${incident.title}`)
                .setSlugifiedName(discussionId)
                .setCreator(this.state.user)
            await modify.getCreator().finish(discussion);

            return incident;
        } catch (err) {
            let alert = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setUsernameAlias(this.state.appName)
                .setGroupable(false)
                .setText('An error occured during the incident creation. Please, try again later');
            await modify.getNotifier().notifyRoom(this.state.room, alert.getMessage());
            throw err;
        }
    }
}
