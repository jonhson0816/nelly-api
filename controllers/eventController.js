const Event = require('../models/Event');
const User = require('../models/User');
const { deleteFile } = require('../config/cloudinary');

// @desc    Create new event
// @route   POST /api/events
// @access  Private
exports.createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      type,
      startDate,
      endDate,
      location,
      onlineLink,
      ticketInfo,
      capacity,
      privacy,
      tags
    } = req.body;

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Handle cover photo upload
    let coverPhoto;
    if (req.file) {
      coverPhoto = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    const event = await Event.create({
      title,
      description,
      organizer: req.user.id,
      coverPhoto,
      category,
      type,
      startDate,
      endDate,
      location: location ? JSON.parse(location) : undefined,
      onlineLink,
      ticketInfo: ticketInfo ? JSON.parse(ticketInfo) : undefined,
      capacity,
      privacy: privacy || 'public',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    await event.populate('organizer', 'firstName lastName avatar username');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events (with filters)
// @route   GET /api/events
// @access  Public
exports.getEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    let query = { status: 'published' };

    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by time period
    if (req.query.period === 'upcoming') {
      query.startDate = { $gte: new Date() };
    } else if (req.query.period === 'past') {
      query.endDate = { $lt: new Date() };
    } else if (req.query.period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.startDate = { $gte: today, $lt: tomorrow };
    } else if (req.query.period === 'this_week') {
      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      query.startDate = { $gte: today, $lte: weekEnd };
    }

    // Filter by location
    if (req.query.city) {
      query['location.city'] = new RegExp(req.query.city, 'i');
    }

    // Search by title
    if (req.query.search) {
      query.title = new RegExp(req.query.search, 'i');
    }

    // Privacy filter
    if (!req.user) {
      query.privacy = 'public';
    }

    const events = await Event.find(query)
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('organizer', 'firstName lastName avatar username')
      .populate('coHosts', 'firstName lastName avatar username')
      .lean();

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'firstName lastName avatar username bio')
      .populate('coHosts', 'firstName lastName avatar username')
      .populate('attendees.user', 'firstName lastName avatar username')
      .populate('discussion.user', 'firstName lastName avatar username');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment views
    event.viewsCount += 1;
    await event.save();

    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Organizer only)
exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is organizer
    if (event.organizer.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }

    // Handle cover photo update
    if (req.file) {
      // Delete old cover photo
      if (event.coverPhoto?.publicId) {
        await deleteFile(event.coverPhoto.publicId);
      }

      event.coverPhoto = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    const {
      title,
      description,
      category,
      type,
      startDate,
      endDate,
      location,
      onlineLink,
      ticketInfo,
      capacity,
      privacy,
      status,
      tags
    } = req.body;

    if (title) event.title = title;
    if (description) event.description = description;
    if (category) event.category = category;
    if (type) event.type = type;
    if (startDate) event.startDate = startDate;
    if (endDate) event.endDate = endDate;
    if (location) event.location = JSON.parse(location);
    if (onlineLink) event.onlineLink = onlineLink;
    if (ticketInfo) event.ticketInfo = JSON.parse(ticketInfo);
    if (capacity) event.capacity = capacity;
    if (privacy) event.privacy = privacy;
    if (status) event.status = status;
    if (tags) event.tags = tags.split(',').map(tag => tag.trim());

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Organizer only)
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is organizer
    if (event.organizer.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }

    // Delete cover photo
    if (event.coverPhoto?.publicId) {
      await deleteFile(event.coverPhoto.publicId);
    }

    // Delete event photos
    if (event.photos?.length > 0) {
      for (const photo of event.photos) {
        if (photo.publicId) {
          await deleteFile(photo.publicId);
        }
      }
    }

    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to event (going, interested, maybe, not_going)
// @route   PUT /api/events/:id/respond
// @access  Private
exports.respondToEvent = async (req, res, next) => {
  try {
    const { status } = req.body; // 'going', 'interested', 'maybe', 'not_going'

    if (!['going', 'interested', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if already responded
    const existingIndex = event.attendees.findIndex(
      a => a.user.toString() === req.user.id
    );

    if (existingIndex !== -1) {
      if (status === 'not_going') {
        // Remove attendee
        event.attendees.splice(existingIndex, 1);
      } else {
        // Update status
        event.attendees[existingIndex].status = status;
      }
    } else {
      if (status !== 'not_going') {
        event.attendees.push({
          user: req.user.id,
          status
        });
      }
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: `Response updated to: ${status}`,
      attendeeCount: event.attendeeCount,
      interestedCount: event.interestedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to event discussion
// @route   POST /api/events/:id/discussion
// @access  Private
exports.addDiscussionComment = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    event.discussion.push({
      user: req.user.id,
      message
    });

    await event.save();

    await event.populate('discussion.user', 'firstName lastName avatar username');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      discussion: event.discussion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get events I'm attending
// @route   GET /api/events/my/attending
// @access  Private
exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({
      'attendees.user': req.user.id,
      'attendees.status': { $in: ['going', 'interested', 'maybe'] }
    })
    .sort({ startDate: 1 })
    .populate('organizer', 'firstName lastName avatar username')
    .lean();

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get events I'm organizing
// @route   GET /api/events/my/organizing
// @access  Private
exports.getMyOrganizedEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort({ startDate: -1 })
      .populate('organizer', 'firstName lastName avatar username')
      .lean();

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
};