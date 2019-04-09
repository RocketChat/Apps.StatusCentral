import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment, MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

import { IncidentStatusEnum } from '../enums/incidentStatus';
import { SettingsEnum } from '../enums/settings';
import { StepEnum } from '../enums/step';
import { IContainer } from '../models/container';
import { RcStatusApp } from '../RcStatusApp';
import { RoomUtility } from '../utils/rooms';
import { UrlUtils } from '../utils/urls';
import { UserUtility } from '../utils/users';
import { IIncidentModel } from './../models/incident';

export class IncidentUpdateWorker {
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async start(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const updateAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'update');
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc, updateAssoc]);

        if (existing.length > 0) {
            const msg = modify.getCreator().startMessage()
                .setGroupable(false)
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are already updating an incident. Please abort if you wish to start over.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const id = context.getArguments()[1];
        this.app.getLogger().log(`Starting to update the incident with the id of: ${ id }`);

        let incident: IIncidentModel;

        try {
            incident = await this.app.getHttpWorker().getIncident(id, read, http);
        } catch {
            const msg = modify.getCreator().startMessage()
                .setGroupable(false)
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText(`Failed to retrieve the incident by the id of \`${ id }\`. You sure it exists?`);

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const container: Partial<IContainer> = {
            step: StepEnum.Creation,
            userId: userAssoc.getID(),
            roomId: roomAssoc.getID(),
            data: incident,
            update: {
                time: new Date(),
            },
        };

        await persis.createWithAssociations(container, [userAssoc, roomAssoc, updateAssoc]);

        const mb = modify.getCreator().startMessage()
                    .setText(`@${ context.getSender().username } has started an update for an incident.\n\nPlease select the status of the update:`)
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const attach: IMessageAttachment = {
            color: '#00aaff',
            timestamp: new Date(),
            title: {
                value: 'Incident Update Status',
            },
            collapsed: true,
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [],
        };

        const params = `?userId=${ container.userId }&roomId=${ container.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        Object.values(IncidentStatusEnum).forEach((s) => {
            if (!attach.actions) {
                return;
            }

            attach.actions.push({
                type: MessageActionType.BUTTON,
                text: s,
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/update${ params }&status=${ s }`),
            });
        });

        mb.addAttachment(attach);

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Describe }&which=update`),
            }],
        };

        mb.addAttachment(finishAttach);

        await modify.getCreator().finish(mb);

        return;
    }

    public async askForExplainCommand(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (data.step !== StepEnum.Creation) {
            // TODO: Maybe display an error showing except step but show current step?
            return;
        }

        if (!data.data.status) {
            // TODO: Maybe display an error?
            return;
        }

        const mb = modify.getCreator().startMessage()
                    .setText('Now, please provide a message for the update the command `/incident explain <brief explanation of the update>`')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async saveExplanation(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const updateAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'update');
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc, updateAssoc]);

        if (existing.length !== 1) {
            const msg = modify.getCreator().startMessage()
                .setGroupable(false)
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are not creating an incident update to explain.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const data = existing[0] as IContainer;
        data.step = StepEnum.Describe;
        data.update.message = context.getArguments().slice(1, context.getArguments().length).join(' ');

        this.app.getLogger().log(data);

        await this.sendDataForReview(data, read, modify);

        await persis.removeByAssociations([userAssoc, roomAssoc, updateAssoc]);
        await persis.createWithAssociations(data, [userAssoc, roomAssoc, updateAssoc]);
    }

    public async sendDataForReview(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (!data.data.id || !data.update.time || !data.update.message || data.update.message.length === 0 || data.step !== StepEnum.Describe) {
            return;
        }

        data.step = StepEnum.Review;

        const mb = modify.getCreator().startMessage()
                    .setText('Please review the incident update. Once you have reviewed, hit the publish button to make it live. :smile:')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;

        const attach: IMessageAttachment = {
            color: '#00d800',
            timestamp: new Date(),
            title: {
                value: 'Update Data',
            },
            collapsed: false,
            text: `
\`\`\`
${ JSON.stringify(data.update, null, 2) }
\`\`\`
            `,
        };

        mb.addAttachment(attach);

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Publish! 🚀',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Publish }&which=update`),
            }],
        };

        mb.addAttachment(finishAttach);

        await modify.getCreator().finish(mb);
    }

    public async publishUpdate(data: IContainer, read: IRead, modify: IModify, http: IHttp): Promise<boolean> {
        if (!data.data.id || !data.update.time || !data.update.message || data.update.message.length === 0 || data.step !== StepEnum.Review) {
            this.app.getLogger().info('invalid data',
                !data.data.id, !data.update.time, !data.update.message,
                data.update.message ? data.update.message.length : 'n/a', data.step !== StepEnum.Review);
            return false;
        }

        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);

        const mb = modify.getCreator().startMessage()
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        let result = false;
        try {
            const inc = await this.app.getHttpWorker().createUpdate(data.data.id, data.update, read, http);

            data.step = StepEnum.Publish;
            mb.setText(`Incident Update created (id \`${ inc.id }\`)! https://${ url }/`);

            result = true;
        } catch (e) {
            mb.setText(`
Sadly, an error occured with the request to create the incident update:

\`${ e.message }\`

Maybe try again?
`);

        }

        await modify.getCreator().finish(mb);

        return result;
    }
}
