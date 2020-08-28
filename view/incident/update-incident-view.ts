import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IncidentService } from "../../service/incident-service";
import { ILogger, IModify, IRead, IHttp } from "@rocket.chat/apps-engine/definition/accessors";
import { IUIKitModalViewParam } from "@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder";
import { IOptionObject } from "@rocket.chat/apps-engine/definition/uikit";
import { EnumCollection } from "../../models/enum/enum-collection";
import { IncidentUpdate } from "../../models/incident-update";
import { ServiceStatusEnum } from "../../models/enum/service-status-enum";
import { Service } from "../../models/service";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

class IncidentUpdateViewState {
    public room: IRoom;
    public user: IUser;
    public incidentID: number;
    public incidentStatuses: EnumCollection<string>[];
    public services: any[];
    public servicesSelected: any[];
    public servicesStatuses: EnumCollection<string>[];

    public static create(): IncidentUpdateViewState {
        return new IncidentUpdateViewState();
    }

    public withRoom(value: IRoom): IncidentUpdateViewState {
        this.room = value;
        return this;
    }

    public withUser(value: IUser): IncidentUpdateViewState {
        this.user = value;
        return this;
    }

    public withIncidentId(value: number): IncidentUpdateViewState {
        this.incidentID = value;
        return this;
    }

    public withIncidentStatuses(value: EnumCollection<string>[]): IncidentUpdateViewState {
        this.incidentStatuses = value;
        return this;
    }

    public withServices(value: any[]): IncidentUpdateViewState {
        this.services = value;
        return this;
    }

    public withServicesSelected(value: any[]): IncidentUpdateViewState {
        this.servicesSelected = value;
        return this;
    }

    public withServicesStatuses(value: EnumCollection<string>[]): IncidentUpdateViewState {
        this.servicesStatuses = value;
        return this;
    }
}

export class IncidentUpdateView {
    private state: IncidentUpdateViewState;
    private service: IncidentService;
    private logger: ILogger;

    constructor(logger: ILogger, service: IncidentService) {
        this.service = service;
        this.logger = logger;
    }

    public async renderAsync(modify: IModify): Promise<IUIKitModalViewParam>  {
        const block = modify.getCreator().getBlockBuilder()
        block
            .addInputBlock({
                blockId: 'vinup_message_input',
                element: block.newPlainTextInputElement({actionId: 'vinup_message_input_value'}),
                label: block.newPlainTextObject('Inform the incident update message')
            })
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the incident status')
            })
            .addActionsBlock({
                blockId: 'vinup_status_static',
                elements: [
                    block.newStaticSelectElement({
                        placeholder: block.newPlainTextObject('Select the incident status'),
                        actionId: 'vinup_status_static_select',
                        options: this.state.incidentStatuses.map((status) => 
                            <IOptionObject> { text: block.newPlainTextObject(status.value), value: status.id }),
                    }),
                ]
            })
            .addDividerBlock()
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the affected services')
            })
            .addActionsBlock({
                blockId: 'vinup_services_multi',
                elements: [
                    block.newMultiStaticElement({
                        placeholder: block.newPlainTextObject('Select the affected services'),
                        actionId: 'vinup_services_multi_select',
                        options: this.state.services.map((service) => 
                            <IOptionObject> { text: block.newPlainTextObject(service.name), value: service.id }),
                        initialValue: this.state.servicesSelected,
                    }),
                ]
            })
            .addDividerBlock();

        if (this.state.servicesSelected) {
            this.state.servicesSelected.forEach((id) => {
                const serviceName = this.state.services.find((service) => service.id == id).name;
                block
                    .addSectionBlock({
                        text: block.newPlainTextObject(`Inform the ${serviceName} status`)
                    })
                    .addActionsBlock({
                        blockId: `vinup_services_${id}_status_static`,
                        elements: [
                            block.newStaticSelectElement({
                                placeholder: block.newPlainTextObject(`Select the status`),
                                actionId: `vinup_services_${id}_status_static_select`,
                                options: this.state.servicesStatuses.map((item) => 
                                    <IOptionObject> { text: block.newPlainTextObject(item.value), value: item.id })
                            })
                        ]
                    })
            });
        }
        
        return {
            id: 'incident_update_view',
            title: block.newPlainTextObject(`Update the incident ${this.state.incidentID}`),
            submit: block.newButtonElement({
                actionId: "vinup_create",
                text: block.newPlainTextObject('Create'),
            }),
            close: block.newButtonElement({
                actionId: "vinup_dismiss",
                text: block.newPlainTextObject('Dismiss')
            }),
            blocks: block.getBlocks()
        }
    }

    public setInitialState(incidentID: number,
        incidentStatuses: EnumCollection<string>[],
        services: Service[],
        servicesStatuses: EnumCollection<string>[],
        room: IRoom,
        user: IUser): void {
        this.state = IncidentUpdateViewState.create()
            .withIncidentId(incidentID)
            .withIncidentStatuses(incidentStatuses)
            .withRoom(room)
            .withUser(user)
            .withServices(services)
            .withServicesStatuses(servicesStatuses);
    }

    public setState(servicesSelected: any[]) {
        this.state = IncidentUpdateViewState.create()
            .withIncidentId(this.state.incidentID)
            .withIncidentStatuses(this.state.incidentStatuses)
            .withRoom(this.state.room)
            .withUser(this.state.user)
            .withServices(this.state.services)
            .withServicesStatuses(this.state.servicesStatuses)
            .withServicesSelected(servicesSelected);
    }

    public onDismiss() : void {}

    public async onSubmitAsync(data: any, modify: IModify, read: IRead, http: IHttp) {
        let update = IncidentUpdate.create()
            .withId(this.state.incidentID)
            .withTime(new Date())
            .withMessage(data['vinup_message_input']['vinup_message_input_value'])
            .withStatus(data['vinup_status_static']['vinup_status_static_select'])
            .withServices(data['vinup_services_multi']['vinup_services_multi_select'].map((index) => { 
                let service = this.state.services[index - 1];
                service.status = ServiceStatusEnum[data[`vinup_services_${index}_status_static`][`vinup_services_${index}_status_static_select`]];
                return service;
            }));
        try {
            const incident = await this.service.createUpdate(this.state.incidentID, update, read, http);
        
            const messageText = `We have an update for the incident *${incident.id}*: ${incident.status.toLocaleUpperCase()}
        
                *Created at*: ${new Date(incident.time).toUTCString()}
                *Created by*: @${this.state.user.username}
                *Updated at*: ${new Date(update.time).toUTCString()}
                *Description*: ${incident.title}

                _*${update.message}*_
                *Services affected**: 
                ${update.services.map(service => `- *${service.name}*: _${service.status}_ \n`).join(' ')}
            `
            const message = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setSender(await read.getUserReader().getByUsername('rocket.cat'))
                .setUsernameAlias('Houston Control')
                .setText(messageText)
    
            await modify.getCreator().finish(message);
            return incident;
        } catch (err) {
            let alert = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setUsernameAlias('Houston Control')
                .setGroupable(false)
                .setText('An error occured during the incident update in statuscentral. Please, try again later');
            await modify.getNotifier().notifyRoom(this.state.room, alert.getMessage());
            throw err;
        }
    }
}