import express, { Request, Response } from "express";
import multer from "multer";
import cloudidary from "cloudinary";
import Hotel, { HotelType } from "../models/hotel";
import verifyToken from "../middleware/auth";
import { body } from "express-validator";

const router = express.Router();

// configure multer to store files in memory.
// this setup allows us to upload files to Cloudinary immediately after receiving them.
// the backend doesn't need to handle the images beyond this point, as they are processed in memory.
const storage = multer.memoryStorage();

// max file size is 5MB per file
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB
  },
});

// api.my-hotels
router.post(
  "/",
  verifyToken,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type").notEmpty().withMessage("Hotel type is required"),
    body("pricePerNight")
      .notEmpty()
      .isNumeric()
      .withMessage("Price per night is required and must be a number"),
    body("facilities")
      .notEmpty()
      .isArray()
      .withMessage("Facilities are required"),
  ],
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    // multipart form request
    try {
      // after we get image files from the request we take the rest of the form properties
      // and assign them to the new hotelHotel variable
      const imageFiles = req.files as Express.Multer.File[];
      const newHotel: HotelType = req.body;

      // 1. upload images to Cloudinary:
      // - iterate over the image files array received from the POST request via multer.
      // - read each file and encode it as a base64 string.
      // - create a data URI string that includes the image's MIME type and base64 string.
      // - use the Cloudinary SDK to upload the image to your Cloudinary account.
      // - on successful upload, get the URL of the hosted image from Cloudinary.
      // - perform these steps for each file in the image files array.
      // - this process returns an array of promises since the uploads are asynchronous.
      // - all uploads are executed concurrently (e.g., 5 images are uploaded simultaneously).
      // - wait for all uploads to finish and then get the array of image URLs.

      const uploadPromises = imageFiles.map(async (image) => {
        const b64 = Buffer.from(image.buffer).toString("base64");
        let dataURI = "data:" + image.mimetype + ";base64," + b64;
        const res = await cloudidary.v2.uploader.upload(dataURI);
        return res.url;
      });

      // 2. if upload was successful, add the urls to the new hotel
      // wait for all images to be uploaded before we get back a string array
      // that gets assigned to this image urls variable
      // browser sends http auth token cookie, middleware parses
      // cookie checks if valid and stores userID in the request
      const imageUrls = await Promise.all(uploadPromises);
      newHotel.imageUrls = imageUrls;
      newHotel.lastUpdated = new Date();
      newHotel.userId = req.userId;

      // 3. save the new hotel in our database
      const hotel = new Hotel(newHotel);
      await hotel.save();

      // 4 . return a 201 status
      res.status(201).send(hotel);
    } catch (error) {
      console.log("Error creating hotel: ", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

export default router;
