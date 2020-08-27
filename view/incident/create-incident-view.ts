import { IModify, ILogger, IRead, IHttp } from '@rocket.chat/apps-engine/definition/accessors';
import { IOptionObject } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { IncidentService } from '../../service/incident-service';
import { Incident } from '../../models/incident';
import { UserUtility } from '../../utils/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { EnumCollection } from '../../models/enum/enum-collection';
import { ServiceStatusEnum } from '../../models/enum/service-status-enum';
import { Service } from '../../models/service';

class IncidentCreateViewState {
    public room: IRoom;
    public incidentStatuses: EnumCollection<string>[];
    public services: any[];
    public servicesSelected: any[];
    public serviceStatuses: EnumCollection<string>[]

    public static create(): IncidentCreateViewState {
        return new IncidentCreateViewState();
    }

    public withRoom(value: IRoom): IncidentCreateViewState {
        this.room = value;
        return this;
    }

    public withIncidentStatuses(value: EnumCollection<string>[]): IncidentCreateViewState {
        this.incidentStatuses = value;
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
        const block = modify.getCreator().getBlockBuilder()
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
                            <IOptionObject> { text: block.newPlainTextObject(status.value), value: status.id }),
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

    public setState(incidentStatuses: EnumCollection<string>[], 
        services: Service[], 
        servicesSelected: any[], 
        serviceStatuses: EnumCollection<string>[],
        room?: IRoom): void {
        if (room) {
            this.state = IncidentCreateViewState.create()
                .withRoom(room)
                .withIncidentStatuses(incidentStatuses)
                .withServices(services)
                .withServicesSelected(servicesSelected)
                .withServiceStatuses(serviceStatuses);
        } else {
            this.state = IncidentCreateViewState.create()
                .withRoom(this.state.room)
                .withIncidentStatuses(incidentStatuses)
                .withServices(services)
                .withServicesSelected(servicesSelected)
                .withServiceStatuses(serviceStatuses);
        }
    }

    public onDismiss() : void {}

    public async onSubmitAsync(data: any, modify: IModify, read: IRead, http: IHttp) : Promise<Incident> {
        let incident = Incident.create()
            .withTime(new Date())
            .withTitle(data['vinc_title_input']['vinc_title_input_value'])
            .withStatus(data['vinc_status_static']['vinc_status_static_select'])
            .withServices(data['vinc_services_multi']['vinc_services_multi_select'].map((index) => { 
                let service = this.state.services[index - 1];
                service.status = ServiceStatusEnum[data[`vinc_services_${index}_status_static`][`vinc_services_${index}_status_static_select`]];
                return service;
            }));
        try {
            incident = await this.service.create(incident, read, http);
        
            const messageText = `We have a new incident *(${incident.id})*: *${incident.status.toLocaleUpperCase()}*
    
                _*${incident.title}*_
                *Services affected**: 
                ${incident.services.map(service => `- *${service.name}*: _${service.status}_ \n`)}
            `
            const message = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setSender(await UserUtility.getRocketCatUser(read))
                .setUsernameAlias('Houston Control')
                .setText(messageText)
    
            await modify.getCreator().finish(message);
            return incident;
        } catch (err) {
            let alert = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setUsernameAlias('Houston Control')
                .setGroupable(false)
                .setText('An error occured during the incident creation in statuscentral. Please, try again later');
            await modify.getNotifier().notifyRoom(this.state.room, alert.getMessage());
            throw err;
        }
    }
}