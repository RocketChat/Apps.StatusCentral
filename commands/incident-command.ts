import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HoustonControl } from '../houston-control';
import { IncidentStatusEnum } from '../models/enum/incident-status-enum';
import { ServiceStatusEnum } from '../models/enum/service-status-enum';
import { SettingsEnum } from '../models/enum/settings-enum';
import { IncidentService } from '../service/incident-service';
import { ServiceService } from '../service/service-service';

export class IncidentCommand implements ISlashCommand {
    public command = 'incident';
    public i18nParamsExample = 'Incident_Command_Params_Example';
    public i18nDescription = 'Incident_Command_Description';
    public permission = 'view-logs';
    public providesPreview = false;

    private app: HoustonControl;
    private incidentService: IncidentService;
    private serviceService: ServiceService;

    constructor(app: HoustonControl, incidentService: IncidentService, serviceService: ServiceService) {
        this.app = app;
        this.incidentService = incidentService;
        this.serviceService = serviceService;
    }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const expectedRoomId = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.ROOM_ID);

        if (expectedRoomId !== context.getRoom().id) {
            return await this.handleIncorrectRoom(context, modify);
        }

        const members = await read.getRoomReader().getMembers(expectedRoomId);

        if (members.filter((m) => m.username.toLowerCase() === 'rocket.cat').length === 0) {
            this.app.getLogger().warn('The Rocket.Cat user is not in the room.');
            return await this.haveThemInviteRocketCatUser(context, modify);
        }

        this.app.getLogger().log(context.getArguments().length);

        switch (context.getArguments().length) {
            case 0:
                return this.handleNoArguments(context, read, modify, http);
            case 1:
                return this.handleOneArgument(context, read, modify, http);
            case 2:
                return this.handleTwoArguments(context, read, modify, http);
            default:
                return this.handleNoArguments(context, read, modify, http);
        }
    }

    private async handleNoArguments(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        const message = modify.getCreator().startMessage()
            .setGroupable(false)
            .setRoom(context.getRoom())
            .setUsernameAlias(this.app.getName())
            .setText('Invalid syntax. Use: `/incident <create|update|close>`');
        await modify.getNotifier().notifyUser(context.getSender(), message.getMessage());
    }

    private async handleOneArgument(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        let message = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setUsernameAlias(this.app.getName())
            .setGroupable(false);

        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
                const triggerId = context.getTriggerId();
                if (triggerId) {
                    try {
                        const incidentStatuses = IncidentStatusEnum.getCollection();
                        const services = await this.serviceService.get(read, http);
                        const servicesStatuses = ServiceStatusEnum.getCollection();
                        const room = context.getRoom();
                        const roomUsers = await read.getRoomReader().getMembers(context.getRoom().id);
                        const user = context.getSender();

                        this.app.getIncidentCreateView().setInitialState(this.app.getName(),
                            incidentStatuses,
                            services,
                            servicesStatuses,
                            room,
                            roomUsers,
                            user);
                        const view = await this.app.getIncidentCreateView().renderAsync(modify);
                        return await modify.getUiController().openModalView(view, { triggerId }, context.getSender());
                    } catch (err) {
                        this.app.getLogger().log(`An error occured during the incident creation request. Error: ${err}`);
                        message = message.setText('An error occured during the incident creation request. Please, try again later');
                        break;
                    }
                } else {
                    break;
                }
            case 'update':
                message = message.setText('Invalid syntax. Update uses: `/incident update <id of incident>`');
                break;
            case 'close':
                message = message.setText('Invalid syntax. Close uses: `/incident close <id of incident>`');
                break;
            default:
                message = modify.getCreator().startMessage()
                    .setGroupable(false)
                    .setRoom(context.getRoom())
                    .setUsernameAlias(this.app.getName())
                    .setText('Invalid syntax. Use: `/incident <create|update|close>`');
        }

        await modify.getNotifier().notifyUser(context.getSender(), message.getMessage());
    }

    private async handleTwoArguments(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        let message = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setUsernameAlias(this.app.getName())
            .setGroupable(false);

        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
                message = message.setText('Invalid syntax. Create uses: `/incident create`');
                break;
            case 'update': {
                const triggerId = context.getTriggerId();
                if (triggerId) {
                    const incidentID = context.getArguments()[1].toLowerCase();
                    try {
                        await this.incidentService.get(incidentID, read, http);
                    } catch (err) {
                        this.app.getLogger().log(`An error occured during search for incident with id ${incidentID}. Error: ${err}`);
                        message = message.setText('Please inform a valid incident');
                        break;
                    }
                    try {
                        const incidentStatuses = IncidentStatusEnum.getCollection();
                        const services = await this.serviceService.get(read, http);
                        const servicesStatuses = ServiceStatusEnum.getCollection();

                        this.app.getIncidentUpdateView().setInitialState(this.app.getName(),
                            Number(incidentID),
                            incidentStatuses,
                            services,
                            servicesStatuses,
                            context.getRoom(),
                            context.getSender());
                        const view = await this.app.getIncidentUpdateView().renderAsync(modify);
                        return await modify.getUiController().openModalView(view, { triggerId }, context.getSender());
                    } catch (err) {
                        this.app.getLogger().log(`An error occured during the incident update request. Error: ${err}`);
                        message = message.setText('An error occured during the incident update request. Please, try again later');
                        break;
                    }
                } else {
                    break;
                }
            }
            case 'close': {
                const triggerId = context.getTriggerId();
                if (triggerId) {
                    const incidentID = context.getArguments()[1].toLowerCase();
                    try {
                        const incident = await this.incidentService.get(incidentID, read, http);
                        try {
                            this.app.getIncidentCloseView().setInitialState(this.app.getName(),
                                incident,
                                context.getRoom(),
                                context.getSender());
                            const view = await this.app.getIncidentCloseView().renderAsync(modify);
                            return await modify.getUiController().openModalView(view, { triggerId }, context.getSender());
                        } catch (err) {
                            this.app.getLogger().log(`An error occured during the incident close request. Error: ${err}`);
                            message = message.setText('An error occured during the incident close request. Please, try again later');
                            break;
                        }
                    } catch (err) {
                        this.app.getLogger().log(`An error occured during search for incident with id ${incidentID}. Error: ${err}`);
                        message = message.setText('Please inform a valid incident');
                        break;
                    }
                } else {
                    break;
                }
            }
            default:
                message = modify.getCreator().startMessage()
                    .setGroupable(false)
                    .setRoom(context.getRoom())
                    .setUsernameAlias(this.app.getName())
                    .setText('Invalid syntax. Use: `/incident <create|update|close>`');
        }

        await modify.getNotifier().notifyUser(context.getSender(), message.getMessage());
    }

    private async handleIncorrectRoom(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias(this.app.getName()).setGroupable(false)
                .setText(`Unexpected room. The room you're in (\`${ context.getRoom().id }\`) is not the expected room.`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }

    private async haveThemInviteRocketCatUser(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias(this.app.getName()).setGroupable(false)
                .setText(`Please invite the @rocket.cat user. (\`/invite @rocket.cat\`)`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }
}
