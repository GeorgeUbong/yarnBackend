import { Request, Response } from 'express';
import { prisma } from "../lib/prisma";
import { createPostSchema } from "../utils/post.validation";

//GET ALL POSTS
export const getPosts = async (
    req: Request,
    res: Response
) => {
    try {
        const posts = await prisma.post.findMany({
            include: {
                author: {
                    select: { id: true, username: true, profileImage: true },
                },
            },
        });

        if (posts.length === 0) {
            return res.status(200).json({
                message: "There are no posts yet",
            });
        }

        return res.status(200).json(posts);
    } catch {
        return res.status(500).json({ message: "Failed to fetch posts" });
    }
}


//get user posts
export const getMyPosts = async (req: Request, res: Response) => {
    try {
        const authorId = Number(req.authorId);

        if (!Number.isSafeInteger(authorId) || authorId <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const posts = await prisma.post.findMany({
            where: { authorId },
            orderBy: { postedAt: "desc" },
            include: {
                author: {
                    select: { id: true, username: true },
                },
            },
        });

        return res.status(200).json(posts);
    } catch {
        return res.status(500).json({ message: "Failed to fetch posts" });
    }
};


// 2. Create a post
export const createPost = async (req: Request, res: Response) => {
    const result = createPostSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors,
        });
    }

    try {
        const authorId = Number(req.authorId);

        if (!Number.isSafeInteger(authorId) || authorId <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const post = await prisma.post.create({
            data: {
                content: result.data.content,
                authorId,
            },
        });

        return res.status(201).json({
            message: "Post created successfully",
            post,
        });
    } catch {
        return res.status(500).json({ message: "Failed to create post" });
    }
};


// 3. Delete your own post
export const deletePost = async (req: Request, res: Response) => {
    try {
        const authorId = Number(req.authorId);
        const postId = req.params.id;

        if (!Number.isSafeInteger(authorId) || authorId <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (typeof postId !== "string" || !postId.trim()) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        const post = await prisma.post.findFirst({
            where: { id: postId, authorId },
        });

        if (!post) {
            return res.status(404).json({
                message: "Post not found or you do not own this post",
            });
        }

        await prisma.post.delete({
            where: { id: post.id },
        });

        return res.status(200).json({
            message: "Post deleted successfully",
        });
    } catch {
        return res.status(500).json({ message: "Failed to delete post" });
    }
};

// Update your own post
export const updatePost = async (req: Request, res: Response) => {
  try {
    const authorId = Number(req.authorId);
    const postId = req.params.id;
    const { content } = req.body;

    if (!Number.isSafeInteger(authorId) || authorId <= 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (typeof postId !== "string" || !postId.trim()) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const post = await prisma.post.findFirst({
      where: { id: postId, authorId },
    });

    if (!post) {
      return res.status(404).json({
        message: "Post not found or you do not own this post",
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: { content: content.trim() },
    });

    return res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch {
    return res.status(500).json({ message: "Failed to update post" });
  }
};


// Search posts across all users
export const searchPosts = async (req: Request, res: Response) => {
  try {
    const query = req.query.q;

    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        message: "you search for anything!",
      });
    }

    const posts = await prisma.post.findMany({
      where: {
        content: {
          contains: query.trim(),
          mode: "insensitive",
        },
      },
      orderBy: { postedAt: "desc" },
      include: {
        author: {
          select: { id: true, username: true },
        },
      },
    });

    if (posts.length === 0) {
      return res.status(200).json({
        message: "No matching posts found",
        
      });
    }

    return res.status(200).json({
      message: "Search results retrieved successfully",
      count: posts.length,
      posts,
    });
  } catch {
    return res.status(500).json({ message: "Failed to search posts" });
  }
};