import { PermissionFlagsBits } from 'discord.js';

class ModerationHandler {
  /**
   * Execute moderation action
   */
  async execute(command, messageOrInteraction, args, isSlash) {
    const action = command.moderationAction;

    if (!action) {
      return this.reply(messageOrInteraction, 'No moderation action configured.', isSlash);
    }

    switch (action) {
      case 'kick':
        await this.kickMember(messageOrInteraction, args, isSlash);
        break;

      case 'ban':
        await this.banMember(messageOrInteraction, args, isSlash);
        break;

      case 'unban':
        await this.unbanMember(messageOrInteraction, args, isSlash);
        break;

      case 'timeout':
        await this.timeoutMember(messageOrInteraction, args, isSlash);
        break;

      case 'purge':
        await this.purgeMessages(messageOrInteraction, args, isSlash);
        break;

      case 'warn':
        await this.warnMember(messageOrInteraction, args, isSlash);
        break;

      default:
        return this.reply(messageOrInteraction, `Unknown moderation action: ${action}`, isSlash);
    }
  }

  /**
   * Kick member
   */
  async kickMember(messageOrInteraction, args, isSlash) {
    const member = isSlash
      ? messageOrInteraction.options.getMember('user')
      : messageOrInteraction.mentions.members.first();

    const reason = isSlash
      ? messageOrInteraction.options.getString('reason') || 'No reason provided'
      : args.slice(1).join(' ') || 'No reason provided';

    if (!member) {
      return this.reply(messageOrInteraction, 'Please mention a user to kick.', isSlash);
    }

    // Permission checks
    if (!this.checkPermissions(messageOrInteraction, PermissionFlagsBits.KickMembers, isSlash)) {
      return;
    }

    if (!member.kickable) {
      return this.reply(messageOrInteraction, 'I cannot kick this member.', isSlash);
    }

    try {
      await member.kick(reason);
      return this.reply(messageOrInteraction, `Successfully kicked ${member.user.tag}. Reason: ${reason}`, isSlash);
    } catch (error) {
      console.error('[ModerationHandler] Error kicking member:', error);
      return this.reply(messageOrInteraction, 'An error occurred while kicking the member.', isSlash);
    }
  }

  /**
   * Ban member
   */
  async banMember(messageOrInteraction, args, isSlash) {
    const member = isSlash
      ? messageOrInteraction.options.getMember('user')
      : messageOrInteraction.mentions.members.first();

    const reason = isSlash
      ? messageOrInteraction.options.getString('reason') || 'No reason provided'
      : args.slice(1).join(' ') || 'No reason provided';

    if (!member) {
      return this.reply(messageOrInteraction, 'Please mention a user to ban.', isSlash);
    }

    // Permission checks
    if (!this.checkPermissions(messageOrInteraction, PermissionFlagsBits.BanMembers, isSlash)) {
      return;
    }

    if (!member.bannable) {
      return this.reply(messageOrInteraction, 'I cannot ban this member.', isSlash);
    }

    try {
      await member.ban({ reason });
      return this.reply(messageOrInteraction, `Successfully banned ${member.user.tag}. Reason: ${reason}`, isSlash);
    } catch (error) {
      console.error('[ModerationHandler] Error banning member:', error);
      return this.reply(messageOrInteraction, 'An error occurred while banning the member.', isSlash);
    }
  }

  /**
   * Unban member
   */
  async unbanMember(messageOrInteraction, args, isSlash) {
    const userId = isSlash
      ? messageOrInteraction.options.getString('userid')
      : args[0];

    if (!userId) {
      return this.reply(messageOrInteraction, 'Please provide a user ID to unban.', isSlash);
    }

    // Permission checks
    if (!this.checkPermissions(messageOrInteraction, PermissionFlagsBits.BanMembers, isSlash)) {
      return;
    }

    try {
      const guild = messageOrInteraction.guild;
      await guild.members.unban(userId);
      return this.reply(messageOrInteraction, `Successfully unbanned user with ID: ${userId}`, isSlash);
    } catch (error) {
      console.error('[ModerationHandler] Error unbanning member:', error);
      return this.reply(messageOrInteraction, 'An error occurred while unbanning the member. Check the user ID.', isSlash);
    }
  }

  /**
   * Timeout member
   */
  async timeoutMember(messageOrInteraction, args, isSlash) {
    const member = isSlash
      ? messageOrInteraction.options.getMember('user')
      : messageOrInteraction.mentions.members.first();

    const duration = isSlash
      ? messageOrInteraction.options.getInteger('duration') * 60 * 1000 // minutes to ms
      : parseInt(args[1]) * 60 * 1000 || 5 * 60 * 1000; // default 5 minutes

    const reason = isSlash
      ? messageOrInteraction.options.getString('reason') || 'No reason provided'
      : args.slice(2).join(' ') || 'No reason provided';

    if (!member) {
      return this.reply(messageOrInteraction, 'Please mention a user to timeout.', isSlash);
    }

    // Permission checks
    if (!this.checkPermissions(messageOrInteraction, PermissionFlagsBits.ModerateMembers, isSlash)) {
      return;
    }

    try {
      await member.timeout(duration, reason);
      const minutes = duration / 60000;
      return this.reply(messageOrInteraction, `Successfully timed out ${member.user.tag} for ${minutes} minute(s). Reason: ${reason}`, isSlash);
    } catch (error) {
      console.error('[ModerationHandler] Error timing out member:', error);
      return this.reply(messageOrInteraction, 'An error occurred while timing out the member.', isSlash);
    }
  }

  /**
   * Purge messages
   */
  async purgeMessages(messageOrInteraction, args, isSlash) {
    const amount = isSlash
      ? messageOrInteraction.options.getInteger('amount')
      : parseInt(args[0]) || 10;

    if (amount < 1 || amount > 100) {
      return this.reply(messageOrInteraction, 'Please provide a number between 1 and 100.', isSlash);
    }

    // Permission checks
    if (!this.checkPermissions(messageOrInteraction, PermissionFlagsBits.ManageMessages, isSlash)) {
      return;
    }

    try {
      const channel = messageOrInteraction.channel;
      const deleted = await channel.bulkDelete(amount, true);
      return this.reply(messageOrInteraction, `Successfully deleted ${deleted.size} message(s).`, isSlash, true);
    } catch (error) {
      console.error('[ModerationHandler] Error purging messages:', error);
      return this.reply(messageOrInteraction, 'An error occurred while purging messages.', isSlash);
    }
  }

  /**
   * Warn member (logs warning)
   */
  async warnMember(messageOrInteraction, args, isSlash) {
    const member = isSlash
      ? messageOrInteraction.options.getMember('user')
      : messageOrInteraction.mentions.members.first();

    const reason = isSlash
      ? messageOrInteraction.options.getString('reason') || 'No reason provided'
      : args.slice(1).join(' ') || 'No reason provided';

    if (!member) {
      return this.reply(messageOrInteraction, 'Please mention a user to warn.', isSlash);
    }

    // For a full implementation, warnings would be stored in the database
    // For now, just send a message
    try {
      await member.send(`You have been warned in ${messageOrInteraction.guild.name}. Reason: ${reason}`);
      return this.reply(messageOrInteraction, `Successfully warned ${member.user.tag}. Reason: ${reason}`, isSlash);
    } catch (error) {
      console.error('[ModerationHandler] Error warning member:', error);
      return this.reply(messageOrInteraction, `Warned ${member.user.tag}, but could not send them a DM.`, isSlash);
    }
  }

  /**
   * Check permissions
   */
  checkPermissions(messageOrInteraction, permission, isSlash) {
    const member = isSlash ? messageOrInteraction.member : messageOrInteraction.member;

    if (!member.permissions.has(permission)) {
      this.reply(messageOrInteraction, 'You do not have permission to use this command.', isSlash);
      return false;
    }

    const botMember = messageOrInteraction.guild.members.me;
    if (!botMember.permissions.has(permission)) {
      this.reply(messageOrInteraction, 'I do not have permission to perform this action.', isSlash);
      return false;
    }

    return true;
  }

  /**
   * Reply helper
   */
  async reply(messageOrInteraction, content, isSlash, ephemeral = false) {
    if (isSlash) {
      if (messageOrInteraction.replied || messageOrInteraction.deferred) {
        return messageOrInteraction.followUp({ content, ephemeral });
      } else {
        return messageOrInteraction.reply({ content, ephemeral });
      }
    } else {
      return messageOrInteraction.reply(content);
    }
  }
}

export default new ModerationHandler();
