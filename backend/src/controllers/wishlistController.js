const User = require('../models/User');

const wishlistPopulate = { path: 'wishlist', populate: { path: 'ownerId', select: 'name email' } };

const getWishlist = async (req, res) => {
  const user = await User.findById(req.user._id).populate(wishlistPopulate);
  res.json(user.wishlist || []);
};

const toggleWishlist = async (req, res) => {
  const { homestayId } = req.body;
  const user = await User.findById(req.user._id);
  const exists = user.wishlist.some((id) => String(id) === String(homestayId));

  if (exists) {
    user.wishlist = user.wishlist.filter((id) => String(id) !== String(homestayId));
  } else {
    user.wishlist.push(homestayId);
  }

  await user.save();
  await user.populate(wishlistPopulate);

  res.json({ wishlist: user.wishlist, inWishlist: !exists });
};

module.exports = { getWishlist, toggleWishlist };
