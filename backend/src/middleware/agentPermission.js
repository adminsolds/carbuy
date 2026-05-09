const { Agent } = require('../models');

const PERMISSION_FIELD_MAP = {
  add_car: 'can_add_car',
  edit_car: 'can_edit_car',
  update_order_status: 'can_update_order_status'
};

const agentPermission = (permissionKey) => async (req, res, next) => {
  try {
    if (req.user?.role !== 'agent') return next();

    const field = PERMISSION_FIELD_MAP[permissionKey];
    if (!field) {
      return res.status(500).json({ error: 'Invalid permission configuration.' });
    }

    const agent = await Agent.findOne({
      where: { access_user_id: req.user.id },
      attributes: ['id', 'is_active', 'access_enabled', field]
    });

    if (!agent || !agent.access_enabled || !agent.is_active) {
      return res.status(403).json({ error: 'Agent backend access is not enabled.' });
    }

    if (!agent[field]) {
      return res.status(403).json({ error: `Agent permission denied: ${permissionKey}.` });
    }

    req.agentProfile = agent;
    return next();
  } catch (error) {
    console.error('Agent permission middleware error:', error);
    return res.status(500).json({ error: 'Failed to validate agent permission.' });
  }
};

module.exports = agentPermission;
